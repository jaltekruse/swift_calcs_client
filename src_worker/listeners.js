var eval_function = function(var_name) {
  /* 
  Will receive a string, var_name, that is asking if we know its value.
  If we do, return its value as a string (and add units if you want)
  and if we dont, return an empty string ''
  */
  var ob = var_name.replace(/SWIFTCALCSMETHOD.*$/,'');
  var method = var_name.replace(/^.*SWIFTCALCSMETHOD/,'');
  var out = '';
  if(constants[ob]) {
  	var out = constants[ob][method];
  	if(typeof out === 'function') out = constants[ob][method]();
  }
  if(typeof out !== 'string') out = '';
  return out;
}
var eval_method = function(method_name, inputs) {
  /*
  Receives two strings.  The first, method_name, is the name of the function
  we are trying to call.  The second, inputs, is a string containing the
  inputs to the function as a comma seperated list (use split to blow it up)
  If we know the function, attempt to evaluate it with the inputs.  Errors should
  be cause and returned as a string with 'ERROR: ' as the first 7 characters.
  If the evaluation is successful, return the results as a string
  If no function of this name is found, return an empty string ''
  */
  if(method_name === 'testf') {
    if(inputs.match(','))
      return 'ERROR: Invalid input to ' + method_name;
    else
      return '23_mm';
  }
  return '';
}
var sendMessage = function(json) {
  postMessage(JSON.stringify(json));
}
var errors = [];
var warnings = [];
var ii = 0;
var receiveMessage = function(command) {
  if(command.giac_version)
    return loadGiac(command.giac_version);
  if(command.increase_timeout) {
    timeout_length += 10;
    return Module.caseval('timeout ' + timeout_length);
  }
  if(command.restart_string) {
    restart_string = command.restart_string;
  }
  if(command.set_units) {
    Module.caseval('clear_usual_units()');
    for(var i = 0; i < command.set_units.length; i++) 
      Module.caseval('set_units(_' + command.set_units[i] + ')');
    return;
  }
  if(command.varList) {
    // If we are asking for the variable list, we simply get that list and return it immediately
    var vars = Module.caseval('VARS').slice(1,-1).split(',');
    if((vars.length == 1) && (vars[0] == '')) vars = [];
    var uvars = vars.slice(0);
    var objects = {};
    for(var key in constants) {// BRENTAN: Maybe change later to 'user_vars' if the constants list grows too large?
      vars.push(key);
      vars.push(key + '.');
      objects[key] = {propertyList:constants[key].propertyList, methodList: constants[key].methodList};
    }
    for(var key in user_vars) {
      uvars.push(key);
    }
    vars = uniq(vars).sort(function (a, b) { return a.toLowerCase().localeCompare(b.toLowerCase()); });
    uvars = uniq(uvars).sort(function (a, b) { return a.toLowerCase().localeCompare(b.toLowerCase()); });
    return sendMessage({command: 'varList', userVarList: uvars, totalVarList: vars, objects: objects})
  }
  // If we are starting a new evaluation, restart giac to reset everything
	if(command.restart)
		Module.caseval('restart;srand;' + restart_string);
	var output = [];
  // Errors and warnings are sometimes (but not always!) caught with Module.printErr (they are sometimes also just returned by caseval directly)
  // to deal with that we define these in the global scope and set them with printErr as things happen
	errors = [];
	warnings = [];
  // If we need to load a scope, do it here
	if(command.previous_scope)
		Module.caseval('unarchive("' + command.previous_scope + '");srand;');
  // Iterate over the command list
	for(ii = 0; ii < command.commands.length; ii++) {
    if(command.commands[ii].pre_command)
      Module.caseval(command.commands[ii].pre_command);
		var to_send = command.commands[ii].command.trim();
		warnings.push([]);
    if(command.commands[ii].unit_convert && (ii > 0)) {
      //BRENTAN: The is a bug if one of the items to convert is numerically 0.  If that happens, the u__s or u__m 'variable' is dropped and so we don't know what units '0' should be in...
      Module.caseval('mksareduce_mode(0);mksavariable_mode(0);'); // disable the special unit command modes
      // Unit convert is a special command.  It means the previous answer, if successful, had units removed and replaced with variable names with mksa_remove and mksa_var.  That answer
      // now needs to be converted back into unit space.  We do that here and insert into this command where the string [val] is placed.
      if(!output[ii-1].success) {
        // previous item was a failure.  copy its results here and continue
        output[ii] = output[ii -1];
        continue;
      }
      // Copy previous warnings over
      warnings[ii] = warnings[ii - 1];
      if(output[ii-1].returned.trim() == '[]') output[ii-1].returned = '[undef]';
      to_send = to_send.replace(/\[val\]/g, output[ii-1].returned.replace(/u__/g,'_'));
      var test_output = { success: true, returned: Module.casevalWithTimeout(to_send) };
      test_output = testError(test_output, ii, to_send);
      if(!test_output.success) { // See if this threw an error, likely a bad units error.  If not, we let full calculation continue
        output.push(test_output);
        continue;
      }
    }
    // If the command is simply a variable name (or object.property transformed to object__property), 
    // and this command is in our global constants array, output its toString value directly
		if(to_send.match(/^[a-z][a-z0-9_]*$/i) && constants[to_send]) {
			output[ii] = {success: true, returned: constants[to_send].toString(), warnings: [], suppress_pulldown: true};
			continue;
		}
    // If we are setting an object into a new variable, we do this directly through the 'clone' method.
		if(to_send.match(/^[a-z][a-z0-9_]* *:= *[a-z][a-z0-9_]*$/i) && constants[to_send.replace(/^[a-z][a-z0-9_]* *:= */i,'')]) {
			var new_var = to_send.replace(/ *:= *[a-z][a-z0-9_]*$/i,'');
			var old_var = to_send.replace(/^[a-z][a-z0-9_]* *:= */i,'');
			constants[new_var] = user_vars[new_var] = constants[old_var].clone();
			output[ii] = {success: true, returned: constants[new_var].toString(), warnings: []};
			continue;
		}
    // Otherwise, lets use giac for our evaluation. 
    // Is this an expression that is setting the value of a variable?  If not, we add some simplification, unit converstion, and set output to latex
    if(to_send.match(/^[\s]*[a-z][a-z0-9_]*(\([a-z0-9_,]+\))?[\s]*:=/i)) {
      var start_pos = to_send.length; // Used by test error reporting.  If column error is reported, we may have to adjust location because of 'evalf(' addition
      // Assignment.  Do the assignment first, then return the value
      if(to_send.match(/^[\s]*([a-z][a-z0-9_]*)[\s]*:=(.*[^a-z0-9]|[\s]*)\1([^a-z0-9_].*|[\s]*)$/i)) {
        // Self-referencing definition (a = a + 1).  Add evalf in order to make sure giac doesn't attempt to do this recursively and symbolically, which is computationally SLOW
        start_pos = to_send.indexOf(':=');        
        to_send = to_send.replace(':=', ':=evalf(') + ')';
      }
      // Test for setting protected variable names
      if(to_send.match(/^[\s]*(i|e|pi)[\s]*:=.*$/)) {
        if(to_send.match(/^[\s]*i[\s]*:=.*$/))
          output[ii] = {success: false, error_index: 0, returned: 'variable name <i>i</i> is protected and defined as sqrt(-1)', warnings: []}
        else if(to_send.match(/^[\s]*e[\s]*:=.*$/))
          output[ii] = {success: false, error_index: 0, returned: 'variable name <i>e</i> is protected and defined as 2.71828', warnings: []}
        else 
          output[ii] = {success: false, error_index: 0, returned: 'variable name <i>&pi;</i> is protected and defined as 3.14159', warnings: []}
        continue;
      }
      // Do the assignment.  Test if there were errors, if so, report those.  If not, and output is asked for, we return the value of the stored variable
      var test_output = { success: true, returned: Module.casevalWithTimeout(to_send) };
      // Work through the warnings.  If any are present and suggesting a different input, lets evaluate that instead
      for(var j = (warnings[ii].length - 1); j >= 0; j--) {
        if(warnings[ii][j].indexOf('Perhaps you meant') > -1) {
          // Use the cas suggestion, as we probably want to use that
          to_send = warnings[ii][j].replace('Perhaps you meant ','');
          errors[ii] = null;
          warnings[ii] = [];
          test_output = { success: true, returned: Module.casevalWithTimeout(to_send)};
          break;
        }
      }
      test_output = testError(test_output, ii, to_send);
      if(test_output.success) {
        to_send = to_send.replace(/^[\s]*([a-zA-Z0-9_]+).*$/,'$1');
      } else {
        // Correct the error index based on whether we added evalf or not
        if(test_output.error_index > start_pos) {
          if((test_output.error_index+1) == to_send.length) test_output.error_index = test_output.error_index - 1;
          test_output.error_index = test_output.error_index - 6;
        }
        output.push(test_output);
        continue;
      }
    } 
    if(!command.commands[ii].nomarkup) {
      // Nomarkup is a flag that ensures we dont add any simplification, latex output commands, or other commands to the input.  This section is run if nomarkup is FALSE
      // if to_send has units associated with it, we attempt to convert to that unit.  On failure, we revert to auto unit handling
      if(to_send.match(/(==|>|<|!=|<=|>=)/))
        var simplify_command = command.commands[ii].simplify ? command.commands[ii].simplify : '';
      else
        var simplify_command = command.commands[ii].simplify ? command.commands[ii].simplify : 'factor';
      if(command.commands[ii].approx)
        simplify_command = 'evalf(' + simplify_command;
      else
        simplify_command = '(' + simplify_command;
      if(command.commands[ii].unit) { // If provided, this is a 2 element array.  The first is the unit in evaluatable text, the second is an HTML representation
        output.push({ success: true, returned: Module.casevalWithTimeout('latex(' + simplify_command + '(ufactor(' + to_send + ',' + command.commands[ii].unit[0] + '))))') });
        /*if((errors[ii] && errors[ii].indexOf('Incompatible units') > -1) || (output[ii].returned.indexOf('Incompatible units') > -1)) {
          // Perhaps the auto-unit conversion messed this up...remove it
          // BRENTAN: FUTURE, we should be 'smarter' here and try to update the expected output unit based on the order of the input.  This should all probably be updated a bit...
          errors[ii] = null;
          warnings[ii] = [];
          output[ii] = { success: true, returned: Module.casevalWithTimeout('latex(usimplify(' + simplify_command + '(' + to_send + '))))') };
          if(!errors[ii] && (output[ii].returned.indexOf('Incompatible units') === -1))
            warnings[ii].push('Incompatible Units: Ignoring requested conversion to ' + command.commands[ii].unit[1]);  // BRENTAN- pretty up the 'unit' output so that it is not in straight text mode
        } */
      } else 
        output.push({ success: true, returned: Module.casevalWithTimeout('latex(usimplify(' + simplify_command + '(' + to_send + '))))') });
      // If evaluation resulted in an error, drop all of our additions (latex, simplify, etc) and make sure that wasn't the problem
      var test_output = testError(output[ii],ii, to_send);
			if(!test_output.success)
				output[ii] = { success: true, returned: Module.casevalWithTimeout(to_send) }
      // Change 1e-4 scientific notation to latex form
      output[ii].returned = output[ii].returned.replace(/([0-9\.]+)e(-?[0-9]+)/g, "\\scientificNotation{$1}{$2}");
    } else {
      // NO MARKUP command
      output.push({ success: true, returned: Module.casevalWithTimeout(to_send) });
    }
    output[ii] = testError(output[ii],ii, to_send);
    // Set any warnings to the output
		output[ii].warnings = warnings[ii];
	}
  // If we are scoped evaluation, we should save the scope now for future retreival
	if(command.scoped) 
		Module.caseval('archive("' + command.next_scope + '")');
  // Return the result to the window thread
  if(command.variable)
    sendMessage({command: 'variable', results: output, callback_id: command.callback_id})
  else
	  sendMessage({command: 'results', results: output, eval_id: command.eval_id, move_to_next: command.move_to_next, callback_id: command.callback_id, focusable: command.focusable, callback_function: command.callback_function});
}
this.addEventListener("message", function (evt) {
  receiveMessage(JSON.parse(evt.data));
},false);

var testError = function(output, ii, to_send) {
  // If there were errors, set the output to the error.  Check both the errors array and the direct output. 
  // Also check for an undefined result, which returns a bit of a complex result from giac
  if(errors[ii]) 
    output = {success: false, returned: errors[ii] };
  else if(output.returned.indexOf("Incompatible units") > -1)
    output = {success: false, returned: fix_message("Incompatible units Error: Please check your equation to ensure units balance")};
  else if(output.returned.indexOf("GIAC_ERROR") > -1)
    output = {success: false, returned: fix_message(output.returned.replace('GIAC_ERROR:',''))};
  else if((output.returned == '"\\,\\mathrm{undef}\\,"') || (output.returned == '"\\begin{bmatrix0}\\,\\mathrm{undef}\\,\\end{bmatrix0} "')) {
    output = {success: true, returned: ''}
    warnings[ii].push('Undefined result - Check for division by zero or inconsistent units');
  } else if(output.returned.match(/,\\mathrm{undef}\\,/))
    warnings[ii].push('Result contains undefined values');
  // If there was an error, try to set the error index to help find the problem in the input
  if(output.success === false) {
    if(output.returned.match(/line [0-9]+ col [0-9]+/i)) {
      //Column returned by giac.  Report it
      output.error_index = output.returned.replace(/^.*line [0-9]+ col ([0-9]+).*$/i, "$1")*1-1;
      output.returned = output.returned.replace(/^(.*)line [0-9]+ col [0-9]+.*$/i, "$1");
    } else if(output.returned.match(/at end of input/i)) {
      output.error_index = to_send.length-1;
      output.returned = output.returned.replace(/^(.*)at end of input.*$/i, "$1");
    } else
      output.error_index = -1;
  }
  return output;
}
var Module = {
  preRun: [],
  postRun: [],
  print: function(text) {
  	if(text.match(/error/) && !text.match(/Warning/))
  		errors[ii] = fix_message(text);
  	else if((text.trim() != '') && (text.indexOf('Success') === -1) && (text.indexOf('Timeout') === -1) && !text.match(/declared as global/) && !text.match(/No check were made for singular points/))
  		warnings[ii].push(fix_message(text));
  },
  printErr: function(text) {
    sendMessage({command: 'printErr', value: text});
  },
  setStatus: function(text) {
    if (Module.setStatus.interval) clearInterval(Module.setStatus.interval);
    sendMessage({command: 'setStatus', value: text});
    if(text === '') {
  		Module.caseval = Module.cwrap('caseval', 'string', ['string']);    
      // Initialize timeout
      // Module.caseval('timeout ' + timeout_length);
      // Module.caseval('ckevery 10000');
    }
  },
  caseval2: function(text) {
    console.log("IN: " + text);
    var out = Module.caseval2(text);
    console.log("OUT: " + out);
    return out;
  },
  casevalWithTimeout: function(text) {
    try {
      return Module.caseval(text);
    } catch(e) {
      if(e.message)
        errors[ii] = fix_message(e.message);
      else
        errors[ii] = fix_message('An unknown error occurred.  This has been recorded with the Swift Calcs dev team.');
      return '';
    }
    /*
    try {
      return Module.caseval(text);
    } catch(e) {
      if(e.message)
        errors[ii] = fix_message(e.message);
      else
        errors[ii] = fix_message('Timeout: Maximum execution time of ' + timeout_length + ' seconds exceeded.  <a href="#" class="increase_timeout">Increase Timeout to ' + (timeout_length + 10) + ' seconds</a>');
      return '';
    }*/
  },
  updateProgress: function(percent) {
    if(Module.progressTimeout !== false) clearTimeout(Module.progressTimeout);
  	sendMessage({command: 'updateProgress', value: percent});
  },
  noProgressInfo: function() {
    if(Module.progressTimeout !== false) return;
    Module.start_timer = Date.now();
    Module.progressTimeout = setTimeout(Module.nextProgress, 250);
  },
  progressPercentage: 0,
  progressTimeout: false,
  nextProgress: function() {
    Module.updateProgress(Math.min(.15 * Math.log(1+(Date.now() - Module.start_timer)/1000),0.49));
    Module.progressTimeout = setTimeout(Module.nextProgress, 250);
  },
  setUpdateTimeout: function(start_val, end_val, total_time) {
  	sendMessage({command: 'setUpdateTimeout', start_val: start_val, end_val:end_val, value: total_time});
  },
  setError: function(text) {
  	sendMessage({command: 'setError', value: text});
  },
  totalDependencies: 0,
  monitorRunDependencies: function(left) {
    this.totalDependencies = Math.max(this.totalDependencies, left);
    Module.setStatus(left ? 'Loading Modules (' + (this.totalDependencies-left) + '/' + this.totalDependencies + ')' : 'All downloads complete.');
		Module.updateProgress((this.totalDependencies-left) / this.totalDependencies * 0.16 + 0.8);
  }
};
Module.setStatus('Downloading');

