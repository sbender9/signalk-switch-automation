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

  plugin.start = function(theOptions) {
    options = theOptions;

    [options.relay1, options.relay2].forEach((conditions,index) => {
      var paths = (conditions || []).map(c => c.path)
      app.debug(`paths: ${index}.${JSON.stringify(paths)}`)
      unsubscribes.push(
        Bacon.combineWith(
          evaluator.bind(this, conditions),
          paths.map(app.streambundle.getSelfStream, app.streambundle)
        )
          .changes()
          .debounceImmediate(20000)
          .onValue(state => {
            if ( !_.isUndefined(state) ) {
              var current = app.getSelfPath(`electrical.venus.relay.${index}.value`)
              if ( !_.isUndefined(current) && current != state ) {
                app.debug(`sending new state ${state} for relay ${index}`)
                app.emit('venusSetValue',
                         {
                           destination: 'com.victronenergy.system',
                           path: `/Relay/${index}/State`,
                           value: state
                         });
              }
            }
          })
      )
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
  };
  
  function stopSubscription()
  {
    onStop.forEach(f => f());
    onStop = []
  }
  
  plugin.schema = function() {
    var paths = JSON.parse(JSON.stringify(app.streambundle.getAvailablePaths())).sort()
    var conditions = {
      type: "array",
      title: "Relay 1 Conditions",
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
            enum: [ "==", "!=", ">", "<"],
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
    var res = {
      type: 'object',
      required: ['relay1', 'realy2'],
      properties: {
        relay1: conditions,
        relay2: JSON.parse(JSON.stringify(conditions))
        }
      }
    res.properties.relay2.title = 'Relay 2 Conditions'
    return res
  }
  
  return plugin;
}
