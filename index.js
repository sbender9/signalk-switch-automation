/**
 * Copyright 2018 Scott Bender (scott@scottbender.net)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


const _ = require('lodash')
const Bacon = require('baconjs')

module.exports = function(app) {
  var plugin = {};
  var unsubscribes = []
  var options

  plugin.id = "signalk-switch-automation";
  plugin.name = "Switch Automation";
  plugin.description = "Plugin that turns a switch on or off based on SignalK values";

  var statusMessage

  plugin.statusMessage = () => {
    return statusMessage
  }

  plugin.start = function(theOptions) {
    app.setPluginStatus('Started')
    if ( !app.putSelfPath ) {
      statusMessage = "Please upgrade your node server, your version does not support put requests"
      return
    }

    options = theOptions;

    options.relays.forEach((relay) => {
      if ( _.isUndefined(relay.enabled) || relay.enabled ) {
        var paths = (relay.conditions || []).map(c => c.path)
        app.debug(`paths: ${relay.relayPath}: ${JSON.stringify(paths)}, cooldown: ${relay.cooldown}`)
        unsubscribes.push(
          Bacon.combineWith(
            evaluator.bind(this, relay.conditions),
            paths.map(app.streambundle.getSelfStream, app.streambundle)
          )
            .changes()
            .debounceImmediate(_.isUndefined(relay.cooldown) ? 3000 : relay.cooldown)
            .onValue(state => {
              if ( !_.isUndefined(state) ) {
                var current = app.getSelfPath(`${relay.relayPath}.value`)
                if ( !_.isUndefined(current) && current != state ) {
                  app.debug(`sending new state ${state} for relay ${relay.relayPath}`)
                  app.setPluginStatus(`sending state ${state} for ${relay.relayPath}`)
                  app.putSelfPath(relay.relayPath, state)

                  /*
                app.emit('venusSetValue',
                {
                destination: 'com.victronenergy.system',
                path: `/Relay/${index}/State`,
                value: state
                });
                  */
                }
              }
            })
        )
      }
    })
  }

  function evaluator(conditions) {
    var args = [...arguments].slice(1);

    app.debug(`args: ${JSON.stringify(args)}`)
    app.debug(`conditions: ${JSON.stringify(conditions)}`)

    var state
    var hadErrors = false
    conditions.forEach((cond, index) => {
      var value =  args[index]
      var testValue;
      var testResult

      if ( cond.value.charAt(0) === '\'' ) {
        testValue = cond.value.substring(1, cond.value.length-1)
      } else {
        testValue = Number(cond.value)
        if ( testValue == NaN ) {
          console.log(`could not convert the condition value to a number ${cond.value}`)
          app.setPluginStatus(`Invalid condition value ${cond.value}`)
          hadErrors = true
          return
        }
      }

      var test = cond.test
      if ( test === '==' ) {
        testResult = value == testValue
      } else if ( test === '!=' ) {
        testResult = value != testValue
      } else if ( test === '<' ) {
        testResult = value < testValue
      } else if ( test === '>' ) {
        testResult = value > testValue
      }

      app.debug(`${index != 0 ? cond.operator : ''} ${value} ${cond.test} ${testValue} = ${testResult}`)

      state = index == 0 ? testResult : (cond.operator == 'And' ? state && testResult : state || testResult)
    });
    return !_.isUndefined(state) && !hadErrors ? (state ? 1 : 0) : undefined
  }

  plugin.stop = function() {
    app.debug("stopping...")
    unsubscribes.forEach(f => f());
    unsubscribes = [];
    app.setPluginStatus('Stopped')
  };

  function stopSubscription()
  {
    onStop.forEach(f => f());
    onStop = []
  }

  plugin.schema = function() {
    var paths = JSON.parse(JSON.stringify(app.streambundle.getAvailablePaths())).sort()
    var res = {
      type: 'object',
      properties: {
        relays: {
          type: 'array',
          title: 'Relays',
          items: {
            type: 'object',
            properties: {
              enabled: {
                type: 'boolean',
                title: 'Enabled',
                default: true
              },
              relayPath: {
                type: 'string',
                title: 'Relay Path',
                enum: paths
              },
              cooldown: {
                type: 'integer',
                title: 'Cooldown Time',
                default: 3000,
                description: "Cooldown time before relay will process next message (in milliseconds)"
              },
              conditions: {
                type: "array",
                title: "Conditions",
                items: {
                  type: "object",
                  title: "Condition",
                  required: ["operator", "path", "test", "value"],
                  properties: {
                    operator: {
                      type: "string",
                      title: "Operator",
                      enum: ["And", "Or" ],
                      default: "And"
                    },
                    path: {
                      type: "string",
                      title: "Path",
                      enum: paths
                    },
                    test: {
                      type: "string",
                      title: "Test",
                      enum: [ "==", "!=", "<", ">"],
                      enumNames: [ "equal to", "not equal to", "less than", "greater than"],
                      default: "=="
                    },
                    value: {
                      type: "string",
                      title: "Value",
                      description: "The value to test against. Use single quotes for strings"
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    return res
  }

  return plugin;
}
