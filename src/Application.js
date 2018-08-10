import React, { Component } from 'react';
import './Application.css';
import { API } from 'aws-amplify';
import { withAuthenticator } from 'aws-amplify-react';

// {
// "gTin": "INSERT VALUE HERE",
//   "lastPrintDate": "INSERT VALUE HERE",
//     "printCount": "INSERT VALUE HERE",
//       "productId": "INSERT VALUE HERE",
//         "productName": "INSERT VALUE HERE",
//           "upcUrl": "INSERT VALUE HERE"
// }

class Application extends Component {
  state = {
    products: [],
  };

  componentDidMount() {
    console.log('I AM NOW MOUNTED!');
    API.get('productListingsCRUD', '/products').then(products => {
      this.setState({ products });
    });
  }

  addProduct = product => {
    API.post('productListingsCRUD', '/products', { body: product }).then(() => {
      this.setState({ products: [product, ...this.state.products] });
    });
  };

  removeProduct = product => {
    API.del('productListingsCRUD', `/products/${product.id}`).then(() => {
      this.setState({
        products: this.state.products.filter(other => other.id !== product.id),
      });
    });
  };

  toggle = product => {
    // const updatedproduct = { ...product, avenged: !product.avenged };

    // PUT IN APP.JS IN BACKEND IN ORDER TO SEE DETAILS ** 
    // API.put('productListingsCRUD', '/products', { body: updatedproduct }).then(() => {
    //   const otherproducts = this.state.products.filter(
    //     other => other.id !== product.id,
    //   );
    //   // this.setState({ products: [updatedproduct, ...otherproducts] });
    // });

  };

  render() {
    // const { products } = this.state;
    // const unavengedproducts = products.filter(product => !product.avenged);
    // const avengedproducts = products.filter(product => product.avenged);

    return (
      <div className="Application">
        Hello, World
      </div>
    );
  }
}
// Export App wrapped with the HOC from Amazon lib
export default withAuthenticator(Application);
