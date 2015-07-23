/*
A command block is a document element that has some command as its output,
and allows a cursor.  The user can move the cursor
left or right around the element, and delete etc.  The command block is also
editable, depending upon settings. It is used to simulate cursor commands
around a command block (like an 'else') so that these items can be deleted.

Option 'allowDelete' will turn the commandBlock into a math block with the remaining text if a portion of the command block text is deleted
Option 'editable' will allow the deletion/insertion of new characters into the block
*/

var CommandBlock = P(function(_) {

	_.allowDelete = false;
	_.cursorPlaced = false;
	_.jQ = 0;
	_.location = 0;
	_.anchor = 0;
	_.cursor = 0;
	_.element = 0;
	_.editable = false;

  var id = 0;
  function uniqueCommandId() { return id += 1; }
  this.byId = {};

	_.init = function(span, el, options) {
		this.jQ = span;
		this.element = el;
		this.handlers = options.handlers;
		this.allowDelete = options.allowDelete;
		this.editable = options.editable;
    this.id = uniqueCommandId();
    CommandBlock.byId[this.id] = this;
    this.cursor = $('<span class="' + css_prefix + 'cursor">&#8203;</span>');
    this.jQ.attr('data-id', this.id);
	}

	_.children = function() {
		return this.jQ.children('var');
	}
	// API Functions that are called by the enclosing element //
	_.keystroke = function(description, event) {
		switch(description) {
			case 'Left':
				this.moveCursor(L);
				break;
			case 'Right':
				this.moveCursor(R);
				break;
			case 'Up':
				this.handlers.upOutOf(this);
				break;
			case 'Down':
				this.handlers.downOutOf(this);
				break;
			case 'Shift-Left':
				this.location--;
				this.updateHighlight();
				break;
			case 'Shift-Right':
				this.location++;
				this.updateHighlight();
				break;
			case 'Shift-Up':
				this.handlers.selectOutOf(L, this);
				break;
			case 'Shift-Down':
				this.handlers.selectOutOf(R, this);
				break;
			case 'End':
				this.placeCursor(this.children().length);
				break;
			case 'Shift-End':
			case 'Ctrl-End':
			case 'Ctrl-Shift-End':
				this.location = this.children().length;
				this.updateHighlight();
				break;
			case 'Home':
				this.placeCursor(0);
				break;
			case 'Shift-Home':
			case 'Ctrl-Home':
			case 'Ctrl-Shift-Home':
				this.location = 0;
				this.updateHighlight();
				break;
	    case 'Ctrl-Shift-Backspace':
	    case 'Ctrl-Backspace':
	    case 'Shift-Backspace':
	    case 'Backspace':
	    case 'Ctrl-Shift-Del':
	    case 'Ctrl-Del':
	    case 'Shift-Del':
	    case 'Del':
    		if(this.allowDelete || this.editable || this.element.empty()) { 
    			// 'allowDelete' means we turn into a math block
    			if(this.children().hasClass('highlighted')) {
    				this.children().slice(min(this.location, this.anchor), max(this.location,this.anchor)).remove();
    				this.location = min(this.anchor, this.location);
    			} else {
    				if((this.location == 0) && (description.indexOf('Backspace') > -1)) {
    					this.handlers.deleteOutOf(L, this);
    					break;
    				}	else if((this.location == this.children().length) && (description.indexOf('Backspace') == -1)) {
    					this.handlers.deleteOutOf(R, this);
    					break;
    				}	else {
    					if(description.indexOf('Backspace') > -1) this.location--;
    					this.children().eq(this.location).remove();
    				}
    			}
    			if(this.allowDelete)
    				this.changeToMath();
		    	else if(this.editable) {
		    		this.element.workspace.save();
		    		if(this.handlers.onSave) this.handlers.onSave();
    				this.placeCursor(this.location);
		    	}
    		} else {
    			// delete out
  				if((this.location == 0) && (description.indexOf('Backspace') > -1)) 
  					this.handlers.deleteOutOf(L, this);
  				else if((this.location == this.children().length) && (description.indexOf('Backspace') == -1)) 
  					this.handlers.deleteOutOf(R, this);
  				else 
    				this.handlers.selectOutOf(L, this);
    		}
    		break;
    	case 'Tab':
    		this.handlers.moveOutOf(R, this);
    		break;
    	case 'Enter':
    		if(this.location === 0) {
    			// Enter pressed in first location.  Check if this is first focusable, or if next is the children area
    			var child_count = 0;
    			var el_count = 0;
    			var count = 0;
    			for(var i = 0; i < this.element.focusableItems.length; i++) {
    				for(var j = 0; j < this.element.focusableItems[i].length; j++) {
    					if(this.element.focusableItems[i][j] === -1) child_count = count;
    					if(this.element.focusableItems[i][j] === this) el_count = count;
    					count++;
    				}
    			}
    			if((child_count + 1) == el_count) // Add item to children of parent
    				math().appendTo(this.element).show(0);
    			else if(el_count == 0) // Add item before parent
						math().insertBefore(this.element).show(0);
    			else // Move to previous focusable
    				this.handlers.moveOutOf(L, this);
    		}	else if(this.location == this.children().length) {
    			// Enter pressed in last location.  Check if this is last focusable, or if next is the children area
    			var child_count = 0;
    			var el_count = 0;
    			var count = 0;
    			for(var i = 0; i < this.element.focusableItems.length; i++) {
    				for(var j = 0; j < this.element.focusableItems[i].length; j++) {
    					if(this.element.focusableItems[i][j] === -1) child_count = count;
    					if(this.element.focusableItems[i][j] === this) el_count = count;
    					count++;
    				}
    			}
    			if((child_count - 1) == el_count) // Add item to children of parent
    				math().prependTo(this.element).show(0).focus(L);
    			else if((count - 1) == el_count) // Add item after parent
						math().insertAfter(this.element).show(0).focus(L);
    			else // Move to next focusable
    				this.handlers.moveOutOf(R, this);
    		}	else
    			this.handlers.moveOutOf(R, this);
    		break;
    	default:
    		return;
		}
    event.preventDefault();
	}
	_.changeToMath = function() {
		this.clearCursor();
		var math = this.text(this.children());
		var math_el = elements.math();
		math_el.insertAfter(this.element).show(0).focus(L);
		math_el.write(math);
		to_move = this.children().length - this.location;
		this.element.remove(0);
		for(var i = 0; i < to_move; i++)
			math_el.keystroke('Left', { preventDefault: function() { } });
	}
	_.typedText = function(text) {
		this.write(text);
	}
	_.cut = function(event) {
		this.copy(event);
    if(!this.allowDelete && !this.editable)
    	showNotice('Cut operation changed to Copy operation');
    else if(this.children().hasClass('highlighted')) {
    	this.keystroke('Del', { });
    	if(this.editable) {
    		this.element.workspace.save();
		    if(this.handlers.onSave) this.handlers.onSave();
    	}
    }
		return this;
	}
	_.empty = function() {
		return this.toString().length == 0
	}
	_.copy = function(event) {
		if(this.children().hasClass('highlighted')) 
			var text = this.text(this.jQ.children('var.highlighted'));
		else
			var text = '';
		this.element.workspace.clipboard = text; this.element.workspace.selectFn(text); 
		return this;
	}
	_.write = function(text) {
		if((text.trim() == '') && !this.editable) return this.flash();
		if(this.editable && text.match(/({|})/)) return this.flash(); // Don't allow some special characters?
    if(this.allowDelete || this.editable || this.element.empty()) {
			if(this.children().hasClass('highlighted')) {
				this.children().slice(min(this.location, this.anchor), max(this.location,this.anchor)).remove();
				this.location = min(this.anchor, this.location);
			}
			text = text.split('');
			for(var i = 0; i < text.length; i++) {
				if(this.location == 0)
					$('<var/>').html(text[i]).prependTo(this.jQ);
				else
					$('<var/>').html(text[i]).insertAfter(this.children().eq(this.location-1));
				this.location++;
			}
			if(this.allowDelete)
				this.changeToMath();
    	else if(this.editable) {
    		this.element.workspace.save();
		    if(this.handlers.onSave) this.handlers.onSave();
    		this.placeCursor(this.location);
    	}
    } else
    	this.flash();
	}
	_.paste = function(text) {
		var clear = this.cursorPlaced;
		this.write(text);
		if(!clear) this.clearCursor();
	}
  _.flash = function() {
    var el = this.jQ.closest('.sc_element');
    el.stop().css("background-color", "#ffe0e0").animate({ backgroundColor: "#FFFFFF"}, {complete: function() { $(this).css('background-color','')} , duration: 400 });
  }
	_.html = function(els) {
	  var fullHtml = '';
		els.each(function() {
		  fullHtml += $(this).html();
		});
		return fullHtml;
	}
	_.text = function(els) {
	  var fullText = '';
		els.each(function() {
		  fullText += $(this).text();
		});
		return fullText;
	}
  _.toString = function() {
		var clear = this.cursorPlaced;
		if(clear) this.clearCursor();
  	var out = this.text(this.children());
		if(clear) this.updateHighlight();
		return out;
  }
	_.mouseOut = function(e) {
		this.clearCursor();
	}
	_.blur = function() {
		this.clearCursor();
	}
	_.windowBlur = function() {
		this.clearCursor();
	}
	_.focus = function(dir) {
		this.element.setFocusedItem(this);
		if(dir === R)
			this.placeCursor(this.children().length);
		else if(dir === L)
			this.placeCursor(0);
		else if(dir) {
			var kids = this.children();
			for(var i = 0; i < kids.length; i++) {
				if(dir < (kids.eq(i).offset().left + kids.eq(i).width()/2)) break;
			}
			this.placeCursor(i);
		}
    else 
    	this.updateHighlight();
    this.scrollToMe(dir);
	}
	_.scrollToMe = function(dir) {
		if(this.jQ) {
			var top = this.jQ.position().top;
			var bottom = top + this.jQ.height();
			var to_move_top = Math.min(0, top);
			var to_move_bot = Math.max(0, bottom - this.element.workspace.jQ.height()+20);
			if((to_move_bot > 0) && (to_move_top < 0)) {
				if(dir === R)
					this.element.workspace.jQ.scrollTop(this.element.workspace.jQ.scrollTop() + to_move_bot);
				else
					this.element.workspace.jQ.scrollTop(this.element.workspace.jQ.scrollTop() + to_move_top);
			}	else
				this.element.workspace.jQ.scrollTop(this.element.workspace.jQ.scrollTop() + to_move_top + to_move_bot);
		}
		return this;
	}
	_.findTarget = function(e) {
		var x_loc = e.originalEvent.pageX;
		var target = $(e.target).closest('var');
		if(target.length == 0) return 0;
		var location = target.prevAll('var').length;
		var mid = target.offset().left + target.width()/2;
		if(x_loc > mid) location++;
		return location;
	}
	_.mouseMove = function(e) {
		this.anchor = this.findTarget(e);
		this.updateHighlight();
	}
	_.mouseUp = function(e) {
		this.anchor = this.findTarget(e);
		this.updateHighlight();
	}
	_.mouseDown = function(e) {
		this.placeCursor(this.findTarget(e));
	}
	_.cursorX = function() {
    if(this.cursor && this.cursor.offset()) return this.cursor.offset().left;
    return undefined;
	}
	_.updateHighlight = function() {
		this.clearCursor();
		if(this.anchor == this.location) 
			this.placeCursor(this.location);
		else if(this.location == -1) {
			this.location++;
			this.handlers.selectOutOf(L,this);
		}
		else if(this.location == (this.children().length + 1)) {
			this.location--;
			this.handlers.selectOutOf(R,this);
		}
		else {
			// We are internal and we are highlighting
			this.children().slice(min(this.location, this.anchor), max(this.location,this.anchor)).addClass('highlighted');
		}
	}

	// Cursor functions //
	_.placeCursor = function(location) {
		this.clearCursor();
		this.location = location;
		this.anchor = location;
		 if((location == 0) && (this.children().length == 0)) {
			this.jQ.prepend(this.cursor);
			this.blinkCursor();
		 } else if(location == 0) {
			this.children().first().prepend(this.cursor);
			this.blinkCursor();
		} else {
			this.cursor.appendTo(this.children()[location-1]);
			this.blinkCursor();
		}
		this.cursorPlaced = true;
	}
	_.blinkCursor = function() {
		var _this = this;
    this.blink = setInterval(function(){ _this.cursor.toggleClass('blink'); }, 500);
	}
	_.moveCursor = function(dir) {
		if(this.children().hasClass('highlighted')) 
			this.location == (dir === L) ? min(this.location, this.anchor) : max(this.location, this.anchor);
		else
			this.location += dir;
		if(this.location === -1) {
			if(this.handlers.moveOutOf(L, this)) return;
			this.location++;
		} else if(this.location === (this.children().length + 1)) {
			if(this.handlers.moveOutOf(R, this)) return;
			this.location--;
		}
		this.placeCursor(this.location);
	}
	_.clearCursor = function() {
    clearInterval(this.blink);
    this.children().removeClass('highlighted');
    this.cursor.removeClass('blink');
		this.cursor.detach();
		this.cursorPlaced = false;
	}
	_.clear = function() {
		this.jQ.html('');
		return this;
	}
});

var commandBlockHTML = function(name, id) {
	nameHTML = '<var>' + name.split('').join('</var><var>') + '</var>';
	return '<span class="' + css_prefix + "command " + css_prefix + name + id + '">' + nameHTML + '</span>';
}
var codeBlockHTML = function(name, id) {
	return commandBlockHTML(name, id).replace(css_prefix + 'command', css_prefix + 'command ' + css_prefix + 'code');
}
var registerCommand = function(_this, klass, options) {
	klass = '.' + css_prefix + klass + _this.id;
  var default_options = getDefaultOptions(_this);
	jQuery.extend(true, default_options, options);
	return CommandBlock(_this.jQ.find(klass), _this, default_options);
}
