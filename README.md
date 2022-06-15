# signalk-switch-automation

Plugin that turns a switch on or off based on SignalK values

Adding switch automation
========================

* Click the plus button to add a switch
* Select the path to the state of the switch (ie electrical.switches.venus-0.state)
* Set cooldown time for the switch (avoid too fast toggling at edge values)
* Click the plus button to add a condition
* Select the path to the Signal K value you'd like to test on
* No need to select an operator for the first condition
* Select the kind of test (equal to, not equal to, less than, greater than)
* Select the value to compare to
* You can add more conditions and then you will need to select an operator

Examples
========

Turn your anchor light on and off automatically:
  * `electrical.inverters.261.acin.voltage` 'is equal' to 0
  * And `environment.sun` 'not equal' to 'day'
  * And `navigation.speedOverGround` 'less than' 0.5
  * And `propulsion.port.revolutions` 'equal to` 0

Turn on your ACR (Automatic Charge Relay) when the engine is running and the AC charger is not on
  * `propulsion.port.revolutions` 'greater than 0
  * And `electrical.chargers.261.chargingMode` 'equal to' 'off'
