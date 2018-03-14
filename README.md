# signalk-switch-automation

Plugin that turns a switch on or off based on SignalK values

(This currently requires the put-support brach on node server)


Adding switch automation
========================

* Click the plus button to add a switch
* Select the path to the state of the switch (ie electrical.switches.venus-0.state)
* Click the plus button to add a condition
* Select the path to the Signal K value you'd like to test on
* No need to select an operator for the first contition
* Select the kind of test (equal to, not equal to, less than, greater than)
* Select the value to compare to 
* You can add more conditions and then you will need to select an operator

Examples
========

Turn your anchor light on and off:
  `electrical.inverters.261.acin.voltage` 'is equal' to 0
  And `environment.sun` 'not equal' to 'day'
  And `navigation.speedOverGround` 'less than' 0.5
  
On enable your ACR (Automatic Charge Relay) on when the engine is running and the AC charger is not on
  `propulsion.port.revolutions` 'greater than 0
   And `electrical.chargers.261.chargingMode` 'equal to' 'off'
