import React, { Component } from 'react';
import NewGrudge from './NewGrudge';
import Grudges from './Grudges';
import './Application.css';
import { API } from 'aws-amplify';
import { withAuthenticator } from 'aws-amplify-react';


class Application extends Component {
  state = {
    grudges: [],
  };

  componentDidMount() {
    console.log('I AM NOW MOUNTED!');
    // API NAME, ENDPOINT, WILL RETURN A PROMISE
    API.get('grudgesCRUD', '/grudges').then(grudges => {
      this.setState({ grudges });
    });
  }

  addGrudge = grudge => {
    API.post('grudgesCRUD', '/grudges', { body: grudge }).then(() => {
      this.setState({ grudges: [grudge, ...this.state.grudges] });
    });
  };

  removeGrudge = grudge => {
    API.del('grudgesCRUD', `/grudges/${grudge.id}`).then(() => {
      this.setState({
        grudges: this.state.grudges.filter(other => other.id !== grudge.id),
      });
    });
  };

  toggle = grudge => {
    const updatedGrudge = { ...grudge, avenged: !grudge.avenged };

    // PUT IN APP.JS IN BACKEND IN ORDER TO SEE DETAILS ** 
    API.put('grudgesCRUD', '/grudges', { body: updatedGrudge }).then(() => {
      const othergrudges = this.state.grudges.filter(
        other => other.id !== grudge.id,
      );
      this.setState({ grudges: [updatedGrudge, ...othergrudges] });
    });

  };

  render() {
    const { grudges } = this.state;
    const unavengedgrudges = grudges.filter(grudge => !grudge.avenged);
    const avengedgrudges = grudges.filter(grudge => grudge.avenged);

    return (
      <div className="Application">
        <NewGrudge onSubmit={this.addGrudge} />
        <Grudges
          title="Unavenged Grudges"
          grudges={unavengedgrudges}
          onCheckOff={this.toggle}
          onRemove={this.removeGrudge}
        />
        <Grudges
          title="Avenged Grudges"
          grudges={avengedgrudges}
          onCheckOff={this.toggle}
          onRemove={this.removeGrudge}
        />
      </div>
    );
  }
}
// Export App wrapped with the HOC from Amazon lib
export default withAuthenticator(Application);
