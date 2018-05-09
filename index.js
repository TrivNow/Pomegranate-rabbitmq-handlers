/**
 * @file index
 * @author Jim Bulkowski <jim.b@paperelectron.com>
 * @project Pomegranate-rabbitmq-tasks
 * @license MIT {@link http://opensource.org/licenses/MIT}
 */

'use strict';

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
      .then(function(files){
        return _fp.map(function(file){
          return Injector.inject(require(file.path));
        }, files)
      })
      .then(function(queues) {
        return RabbitConnection.createChannel()
          .then(function(channel){
            PluginContext.channel = channel
            _fp.each(function(queue){
              channel.assertQueue(queue.name, {durable: true})
            }, queues)
            return channel
          })
          .then(function(channel){
            return _fp.map(function(queue){
              return function(){
                Logger.log(`${queue.name} handler Starting.`)
                return channel.consume(queue.name, queue.handler.bind(channel))
              }

            }, queues)
          })

      })
      .then(function(activeQueues){
        PluginContext.queues = activeQueues
        return true
      })

  },
  start: function(PluginContext, Logger) {
    _fp.each((queue) => {
      if(_fp.isFunction(queue)){
        queue()
      }
    }, PluginContext.queues)
  },
  stop: function(PluginContext, Logger) {
    if(_fp.hasIn('channel.close', PluginContext) && _fp.isFunction(PluginContext.channel.close)){
      Logger.log('Closing Channel.')
      return PluginContext.channel.close().then(() => {
        Logger.log('Channel closed successfully')
      })
    }
    Logger.warn('No channel found.')
    return true
  }
}