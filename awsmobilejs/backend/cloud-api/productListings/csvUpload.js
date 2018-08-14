/**
 * Uploads CSV data to DynamoDB.
 *
 * 1. Streams a CSV file line-by-line.
 * 2. Parses each line to a JSON object.
 * 3. Collects batches of JSON objects.
 * 4. Converts batches into the PutRequest format needed by AWS.DynamoDB.batchWriteItem
 *    and runs 1 or more batches at a time.
 */

const AWS = require("aws-sdk")
const chalk = require('chalk')
const fs = require('fs')
const split = require('split2')
const uuid = require('uuid')
const through2 = require('through2')
const { Writable } = require('stream');
const { Transform } = require('stream');

// A whitelist of the CSV columns to ingest.

// {
// "gTin": "INSERT VALUE HERE",
//   "lastPrintDate": "INSERT VALUE HERE",
//     "printCount": "INSERT VALUE HERE",
//       "productId": "INSERT VALUE HERE",
//         "productName": "INSERT VALUE HERE",
//           "upcUrl": "INSERT VALUE HERE"
// }


const CSV_KEYS = [
  "GTIN",
  "ProductDescription",
  "SKU"
]

// Inadequate WCU will cause "insufficient throughput" exceptions, which in this script are not currently  
// handled with retry attempts. Retries are not necessary as long as you consistently
// stay under the WCU, which isn't that hard to predict.

// The number of records to pass to AWS.DynamoDB.DocumentClient.batchWrite
// See https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_BatchWriteItem.html
const MAX_RECORDS_PER_BATCH = 25

// The number of batches to upload concurrently.  
// https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/node-configuring-maxsockets.html
const MAX_CONCURRENT_BATCHES = 1

// MAKE SURE TO LAUNCH `dynamodb-local` EXTERNALLY FIRST IF USING LOCALHOST!

// Create a file line reader.
var fileReaderStream = fs.createReadStream(CSV_FILE_PATH)
var lineReaderStream = fileReaderStream.pipe(split())

var linesRead = 0

// Attach a stream that transforms text lines into JSON objects.
var skipHeader = true
var csvParserStream = lineReaderStream.pipe(
  through2(
    {
      objectMode: true,
      highWaterMark: 1
    },
    function handleWrite(chunk, encoding, callback) {

      // ignore CSV header
      if (skipHeader) {
        skipHeader = false
        callback()
        return
      }

      linesRead++

      // transform line into stringified JSON
      const values = chunk.toString().split(',')
      const ret = {}
      CSV_KEYS.forEach((keyName, index) => {
        ret[keyName] = values[index]
      })
      ret.line = linesRead

      console.log(chalk.cyan.bold("csvParserStream:",
        "line:", linesRead + ".",
        chunk.length, "bytes.",
        ret.id
      ))

      callback(null, ret)
    }
  )
)

const CSVUpload = (db) => {
// Attach a stream that collects incoming json lines to create batches. 
// Outputs an array (<= MAX_CONCURRENT_BATCHES) of arrays (<= MAX_RECORDS_PER_BATCH).
var batchingStream = (function batchObjectsIntoGroups(source) {
  var batchBuffer = []
  var idx = 0

  var batchingStream = source.pipe(
    through2.obj(
      {
        objectMode: true,
        writableObjectMode: true,
        highWaterMark: 1
      },
      function handleWrite(item, encoding, callback) {
        var batchIdx = Math.floor(idx / MAX_RECORDS_PER_BATCH)

        if (idx % MAX_RECORDS_PER_BATCH == 0 && batchIdx < MAX_CONCURRENT_BATCHES) {
          batchBuffer.push([])
        }

        batchBuffer[batchIdx].push(item)

        if (MAX_CONCURRENT_BATCHES == batchBuffer.length &&
          MAX_RECORDS_PER_BATCH == batchBuffer[MAX_CONCURRENT_BATCHES - 1].length) {
          this.push(batchBuffer)
          batchBuffer = []
          idx = 0
        } else {
          idx++
        }

        callback()
      },
      function handleFlush(callback) {
        if (batchBuffer.length) {
          this.push(batchBuffer)
        }

        callback()
      }
    )
  )

  return (batchingStream);
})(csvParserStream)

// Attach a stream that transforms batch buffers to collections of DynamoDB batchWrite jobs.
var databaseStream = new Writable({

  objectMode: true,
  highWaterMark: 1,

  write(batchBuffer, encoding, callback) {
    console.log(chalk.yellow(`Batch being processed.`))

    // Create `batchBuffer.length` batchWrite jobs.
    var jobs = batchBuffer.map(batch =>
      buildBatchWriteJob(batch)
    )

    // Run multiple batch-write jobs concurrently.
    Promise
      .all(jobs)
      .then(results => {
        console.log(chalk.bold.red(`${batchBuffer.length} batches completed.`))
      })
      .catch(error => {
        console.log(chalk.red("ERROR"), error)
        callback(error)
      })
      .then(() => {
        console.log(chalk.bold.red("Resuming file input."))

        setTimeout(callback, 900) // slow down the uploads. calculate this based on WCU, item size, batch size, and concurrency level.
      })

    // return false
  }
})
batchingStream.pipe(databaseStream)

// Builds a batch-write job that runs as an async promise.
function buildBatchWriteJob(batch) {
  let params = buildRequestParams(batch)

  // This was being used temporarily prior to hooking up the script to any dynamo service.


  let promise = new Promise(
    function (resolve, reject) {
      let t0 = new Date().getTime()

      let printItems = function (msg, items) {
        console.log(chalk.green.bold(msg, pluckValues(batch, "id")))
      }

      let processItemsCallback = function (err, data) {
        if (err) {
          console.error(`Failed at batch: ${pluckValues(batch, "line")}, ${pluckValues(batch, "id")}`)
          console.error("Error:", err)
          reject()
        } else {
          var params = {}
          params.RequestItems = data.UnprocessedItems

          var numUnprocessed = Object.keys(params.RequestItems).length
          if (numUnprocessed != 0) {
            console.log(`Encountered ${numUnprocessed}`)
            printItems("Retrying unprocessed items:", params)
            db.batchWriteItem(params, processItemsCallback)
          } else {
            console.log(chalk.dim.yellow.italic(`Batch upload time: ${new Date().getTime() - t0}ms`))

            resolve()
          }
        }
      }
      db.batchWriteItem(params, processItemsCallback)
    }
  )
  return (promise)
}

// Build request payload for the batchWrite
function buildRequestParams(batch) {

  var params = {
    RequestItems: {}
  }
  params.RequestItems.Provider = batch.map(obj => {

    let item = {}

    CSV_KEYS.forEach((keyName, index) => {
      if (obj[keyName] && obj[keyName].length > 0) {
        item[keyName] = { "S": obj[keyName] }
      }
    })

    return {
      PutRequest: {
        Item: item
      }
    }
  })
  return params
}

function pluckValues(batch, fieldName) {
  var values = batch.map(item => {
    return (item[fieldName])
  })
  return (values)
}

};

export default CSVUpload;