# About

**Pooling generic resources for multi-server environment.**

This module extends [Generic resource pool module](https://github.com/coopernurse/node-pool), which can be used to reuse expensive resources. 
Node-pool-cluster module allows pooling connections to multi-server environments, it creates connection pools for multiple servers in a cluster, thus
providing load balancing of requests to these connection pools.

A separate connection pool is created for each server added in the cluster. Requests for resources are load balance between different server pools added.
The module balances request in round-robin fashion if the pools have zero waiting queue, otherwise request is served by least busy server pool. 


## Table of contents

* [Installation](#installation)
* [Usage](#usage)
  * [Create cluster pool using a poolFactory object](#create-an-object-of-node-pool-cluster-using-a-poolfactory-object)
  * [Add servers to the node-pool cluster](#add-servers-to-the-node-pool-cluster)
  * [Use cluster pool in your code to acquire/release resources](#use-cluster-pool-in-your-code-to-acquirerelease-resources)
* [How the load balancing works](#how-the-load-balancing-works)
* [Additional functions](#additional-functions)
* [Run tests](#run-tests)
* [Version History](#version-history)
* [License](#license) (The MIT License)

## Installation

```
$ npm install node-pool-cluster
```

## Usage

The module uses similar convention used in [generic-pool module](https://github.com/coopernurse/node-pool).
Any one familiar with node-pool module, will be able to easily switch to node-pool-cluster module, with minimal changes.

### Create an object of node-pool-cluster using a poolFactory object

```javascript
// Create a MySQL connection pool with a max of 5 connections, and a min of 2
// with a 20 seconds max idle time. These settings will be used for all pools
// created for individual servers.
var NodePoolCluster = require('node-pool-cluster');

var nodePoolCluster = NodePoolCluster.initCluster({
  name: 'mysql-client',
  destroy: function(mySqlClient) { mySqlClient.end(); },
  max: 5,
  min: 2,
  idleTimeoutMillis : 20000
});
```

One thing to note that poolFactory object doesn't contain create function, which is there in generic-pool module.
However create function will have to passed when adding a server to the cluster.
For documentation of poolFactory object fields (and other pool features), please refer to [generic-pool documentation](https://github.com/coopernurse/node-pool#documentation).

### Add servers to the node-pool cluster

```javascript
var MySQLClient = require('mysql').Client;

// Adding server 1 to the node-pool cluster
nodePoolCluster.addPool(function(callback) {
  var mySqlClient = new MySQLClient();
  mySqlClient.user = 'username';
  mySqlClient.password = 'password';
  mySqlClient.database = 'dbname';
  mySqlClient.host = 'host1';
  mySqlClient.connect(function(err) {
    callback(err, mySqlClient);  
  });
});

// Adding server 2 to the node-pool cluster
nodePoolCluster.addPool(function(callback) {
  var mySqlClient = new MySQLClient();
  mySqlClient.host = 'host2';
  mySqlClient.user = 'username';
  mySqlClient.password = 'password';
  mySqlClient.database = 'dbname';
  mySqlClient.connect(function(err) {
    callback(err, mySqlClient);  
  });
});

// … repeat for as many servers as you have in cluster.
```

In the above example, we have added two servers(host1 & host2) to the cluster. 
Each of these servers will have a separate connection pool created with settings from the poolFactory object used to create server pool.

### Use cluster pool in your code to acquire/release resources

```javascript
// Acquire connection - callback function is called once a resource becomes
// available.
nodePoolCluster.acquire(function(err, mySqlClient, pool) {
  if (err) {
    // Handle error - this is generally the err from your create function.
  } else {
    mySqlClient.query('SELECT * FROM table', [], function() {
      // Release connection object back to the pool.
      pool.release(mySqlClient);
    });
  }
});
```

If you're familiar with generic-pool, you'll see the only difference is that your callback function receives not only client connection, 
but also pool object for the server which has been chosen to serve your request. 
You will be using it to release client back to the specific pool.

## How the load balancing works

Each server in the cluster has its own connection pool created with specified min and max number of connections. 
They are launched when first needed in a round-robin fashion and then are waiting to be reused.
Whenever a new connection request comes, it first checks if any launched connections are available, it then distributes request in round-robin
order between servers, thus maintaining equal share of requests among servers.

If all connections are busy, then the request is sent to the server pool with shortest waiting queue.

## Error handling

Error handling is similar to generic-pool module.

## Additional functions

### getPoolSize()

Return total number of launched connections in all server pools.

### removePool()

Removes a server pool from the cluster. It also drains the pool gracefully.

### clear()

Removes all the server pools from cluster and drains the pools gracefully.

### drainAll()

Drains all the pool in the server gracefully.



## Run tests

```
$ npm install mocha
$ npm test
```

## Version History

### 0.1.0 - Jan 22, 2016

* First release.

## License

The MIT License (MIT)

Copyright (c) 2016 Kapil Joshi  <<kjoshi1988@gmail.com>>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.