/**
 * @file index
 * @author Jim Bulkowski <jim.b@paperelectron.com>
 * @project Pomegranate-rabbitmq-tasks
 * @license MIT {@link http://opensource.org/licenses/MIT}
 */

'use strict';
const Promise = require('bluebird')
const path = require('path')
const _ = require('lodash')
const _fp = require('lodash/fp')

/**
 *
 * @module RabbitWorkQueues
 */

exports.options = {
  workDir: './RMQ_handlers'
}

exports.metadata = {
  frameworkVersion: 6,
  name: 'RabbitHandlers',
  type: 'action',
  depends: ['RabbitConnection']
}

exports.plugin = {
  load: function(Injector, PluginFiles, Options, Logger, PluginContext, RabbitConnection) {
    PluginFiles.fileList()
      .then(function(files) {
        return _fp.map(function(file) {
          return Injector.inject(require(file.path));
        }, files)
      })
      .then(function(queues) {
        return RabbitConnection.createChannel()
          .then(function(channel) {
            PluginContext.channel = channel

            // Create the exchanges and queues based on exported object
            return Promise.map(queues, (queue) => {
              // Exchange exclusive queue
              let ct = queue.type
              let options = queue.options || {durable: true}

              if(ct === 'direct' || ct === 'fanout' || ct === 'topic' || ct === 'headers') {
                let pattern = queue.pattern || ''
                Logger.log(`${ct} Exchange found.`)
                return channel.assertExchange(queue.name, queue.type, options)
                  .then((r) => {
                    return channel.assertQueue('', {exclusive: true})
                  })
                  .then((q) => {
                    // Bind the exclusive queue to the exchange.
                    // Then return the exclusive exchange to capture the generated name.
                    return channel.bindQueue(q.queue, queue.name, pattern).then(() => q)
                  })
                  .then((q) => {
                    return function() {
                      Logger.log(`${queue.name} handler Starting.`)
                      return channel.consume(q.queue, queue.handler.bind(channel))
                    }
                  })
              }

              // Actual queues
              return channel.assertQueue(queue.name, options)
                .then((q) => {
                  return function() {
                    Logger.log(`${queue.name} handler Starting.`)
                    return channel.consume(q.queue, queue.handler.bind(channel))
                  }
                })

            })

          })
      })
      .then(function(activeQueues) {
        PluginContext.queues = activeQueues
        return true
      })

  },
  start: function(PluginContext, Logger) {
    _fp.each((queue) => {
      if(_fp.isFunction(queue)) {
        queue()
      }
    }, PluginContext.queues)
  },
  stop: function(PluginContext, Logger) {
    if(_fp.hasIn('channel.close', PluginContext) && _fp.isFunction(PluginContext.channel.close)) {
      Logger.log('Closing Channel.')
      return PluginContext.channel.close().then(() => {
        Logger.log('Channel closed successfully')
      })
    }
    Logger.warn('No channel found.')
    return true
  }
}