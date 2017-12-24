const debug = require("debug")("signalk-venus-relay");
const _ = require('lodash')
const Bacon = require('baconjs')

module.exports = function(app) {
  var plugin = {};
  var unsubscribes = []
  var options

  plugin.id = "signalk-venus-relay";
  plugin.name = "Venus Relay";
  plugin.description = "Plugin that sets the relay on a Venus GX based on SignalK values";

  plugin.start = function(theOptions) {
    options = theOptions

    debug("start");

    var paths = options.conditions.map(c => c.path)
    debug(`paths: ${JSON.stringify(paths)}`)
    unsubscribes.push(
      Bacon.combineWith(
        evaluator,
        paths.map(app.streambundle.getSelfStream, app.streambundle)
      )
        .changes()
        .debounceImmediate(20000)
        .onValue(state => {
          console.log(`state ${state}`)
          if ( !_.isUndefined(state) ) {
            app.emit('venusSetValue',
                     {
                       destination: 'com.victronenergy.system',
                       path: `/Relay/${options.relay}/State`,
                       value: state ? 1 : 0
                     });
          }
        })
    )
  }

  function evaluator() {
    var args = [...arguments];

    var state
    var hadErrors = false
    options.conditions.forEach((cond, index) => {
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
      
      debug(`${index != 0 ? cond.operator : ''} ${value} ${cond.test} ${testValue} = ${testResult}`)

      state = index == 0 ? testResult : (cond.operator == 'And' ? state && testResult : state || testResult)
    });
    return !_.isUndefined(state) && !hadErrors ? state : undefined
  }
  
  plugin.stop = function() {
    debug("stopping...")
    unsubscribes.forEach(f => f());
    unsubscribes = [];
  };
  
  function stopSubscription()
  {
    onStop.forEach(f => f());
    onStop = []
  }
  
  plugin.schema = function() {
    var paths = app.streambundle.getAvailablePaths().sort()
    return {
      type: 'object',
      required: ['relay'],
      properties: {
        relay: {
          type: 'number',
          title: 'Relay #',
          enum: [ 0, 1 ],
          default: 0
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
      }
    }
  }
  
  return plugin;
}
