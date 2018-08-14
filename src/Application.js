import React, { Component } from 'react';
import './Application.css';
import AppHeader from './AppHeader';
import ProductListings from './ProductListings';
import { API } from 'aws-amplify';
import { withAuthenticator } from 'aws-amplify-react';


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

  runCSVUpload = () => {
    API.post('productListingsCRUD', 'products/upload').then( () => {
        console.log('yo it launched the route')
    })
  }
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
    const { products } = this.state;

    return (
      <div className="Application">
        <AppHeader />
        <div className="table-contents-area">
          <ProductListings products={products} />
          <button onClick={() => this.runCSVUpload }>Load CSVs</button>
        </div>
        <p>Inventory Barcode Generator / Printer - US Netting &copy; 2018</p>
      </div>
    );
  }
}
// Export App wrapped with the HOC from Amazon lib
export default withAuthenticator(Application);
