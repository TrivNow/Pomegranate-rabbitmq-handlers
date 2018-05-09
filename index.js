/**
 * @file index
 * @author Jim Bulkowski <jim.b@paperelectron.com>
 * @project Pomegranate-rabbitmq-tasks
 * @license MIT {@link http://opensource.org/licenses/MIT}
 */

'use strict';

const path = require('path')
const _ = require('lodash')

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
  load: function(Injector, PluginFiles, Options, Logger, RabbitConnection) {

    PluginFiles.fileList()
      .then(function(files){
        return _.map(files, function(file){
          return Injector.inject(require(file.path));
        })
      })
      .then(function(queues) {
        return RabbitConnection.createChannel()
          .then(function(channel){
            _.each(queues, function(queue){
              channel.assertQueue(queue.name, {durable: true})
            })
            return channel
          })
          .then(function(channel){
            return _.map(queues, function(queue){
              return channel.consume(queue.name, queue.handler.bind(channel))
            })
          })

      })
      .then(function(activeQueues){
        return true
      })

  }
}