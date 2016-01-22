var GenericPool = require('generic-pool');
var _ = require('underscore');

module.exports = {
    /**
     * Create a cluster of pools with a specified poolFactoryOpts.
     *
     * poolFactoryOpts object is similar to generic-pool module factory object,
     * except that it doesn't include create method.
     * poolFactoryOpts docs is a replica of generic-pool module docs:
     *
     * @param {Object} poolFactoryOpts
     *   Factory to be used for generating and destorying the items.
     * @param {String} poolFactoryOpts.name
     *   Name of the factory. Serves only logging purposes.
     * @param {Function} poolFactoryOpts.destroy
     *   Should gently close any resources that the item is using.
     *   Called before the items is destroyed.
     * @param {Function} poolFactoryOpts.validate
     *   Should return true if connection is still valid and false
     *   If it should be removed from pool. Called before item is
     *   acquired from pool.
     * @param {Number} poolFactoryOpts.max
     *   Maximum number of items that can exist at the same time.  Default: 1.
     *   Any further acquire requests will be pushed to the waiting list.
     * @param {Number} poolFactoryOpts.min
     *   Minimum number of items in pool (including in-use). Default: 0.
     *   When the pool is created, or a resource destroyed, this minimum will
     *   be checked. If the pool resource count is below the minimum, a new
     *   resource will be created and added to the pool.
     * @param {Number} poolFactoryOpts.idleTimeoutMillis
     *   Delay in milliseconds after the idle items in the pool will be destroyed.
     *   And idle item is that is not acquired yet. Waiting items doesn't count here.
     * @param {Number} poolFactoryOpts.reapIntervalMillis
     *   Cleanup is scheduled in every `factory.reapIntervalMillis` milliseconds.
     * @param {Boolean|Function} poolFactoryOpts.log
     *   Whether the pool should log activity. If function is specified,
     *   that will be used instead. The function expects the arguments msg, loglevel
     * @param {Number} poolFactoryOpts.priorityRange
     *   The range from 1 to be treated as a valid priority
     * @param {RefreshIdle} poolFactoryOpts.refreshIdle
     *   Should idle resources be destroyed and recreated every idleTimeoutMillis? Default: true.
     *
     * @returns {Object} A Cluster Pool object.
     */
    initCluster: function (poolFactoryOpts) {
        var _this = {}, _cluster = [];

        /**
         * Adds server to the cluster.
         *
         * @param {Function} createClient Should create the item to be acquired,
         *   and call it's first callback argument with the generated item as its
         *   argument.
         */
        _this.addPool = function (createClient) {
            var _pool, _poolOptions = _.clone(poolFactoryOpts);
            _poolOptions.create = createClient;
            _pool = GenericPool.Pool(_poolOptions);
            _cluster.push(_pool);
            return _pool;
        };

        /**
         * Removes server from the cluster.
         *
         * @param {Object} pool it should be the same server pool, which
         * was returned when adding the server to the cluster.
         * @return {Object} true, if server is successfully removed from cluster, else false.
         */
        _this.removePool = function (pool) {
            var index = _.indexOf(_cluster, pool);
            if (index != -1) {
                _cluster.splice(index, 1);
                pool.drain(function () {
                    pool.destroyAllNow();
                });
                return true;
            }
            return false;
        };

        /**
         * Return total number of created clients in all pools.
         *
         * @return {Number} Number of client connections.
         */
        _this.getPoolSize = function () {
            var count = 0;
            _cluster.forEach(function (pool) {
                count += pool.getPoolSize();
            });
            return count;
        };

        /**
         * Removes all the server pools from cluster
         */
        _this.clear = function () {
            _cluster.forEach(function (pool) {
                pool.drain(function () {
                    pool.destroyAllNow();
                });
            });
            _cluster = [];
        };

        /**
         * Drains all the pools in the cluster
         */
        _this.drainAll = function () {
            _cluster.forEach(function (pool) {
                pool.drain(function () {
                    pool.destroyAllNow();
                });
            });
        };


        /**
         * Requests a new client from cluster pool. The callback will be called
         * when a new client will be available.
         * Selected pool will also be passed so that you can release the client
         * to the pool after use.
         *
         * @param {Function} callback(err, client, pool)
         *   Callback function to be called after the acquire is successful.
         * @returns {Object} true if pools are not fully utilized, false otherwise.
         */
        _this.acquire = function (callback) {
            if (_cluster.length === 0) {
                return callback(new Error('No pool server added yet'));
            }

            var _poolIndex = 0, _currentPool, _poolMinWaitClient;

            /**
             * Selecting suitable pool to handle request.
             * If there's no waiting queue of requests awaiting to acquire connection
             * then pools are round-robin rotated.
             * If there's a queue, pool with the shortest queue is selected.
             */
            while (_poolIndex < _cluster.length) {
                _currentPool = _cluster[_poolIndex];
                if (_currentPool.waitingClientsCount() == 0) {
                    _poolMinWaitClient = _currentPool;
                    break;
                } else {
                    if (!_poolMinWaitClient ||
                        (_currentPool.waitingClientsCount() < _poolMinWaitClient.waitingClientsCount())) {
                        _poolMinWaitClient = _currentPool; //pool with shortest queue
                    }
                }
                _poolIndex++;
            }

            return _poolMinWaitClient.acquire(function (err, client) {
                return callback(err, client, _poolMinWaitClient);
            });
        };

        return _this;
    }
};