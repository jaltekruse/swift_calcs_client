
var bookmark = P(EditableBlock, function(_, super_) {
	_.klass = ['bookmark'];

	_.innerHtml = function() {
		return '<div class="' + css_prefix + 'focusableItems" data-id="0">' + commandBlockHTML('', this.id) + helpBlock() + '</div>';
	}
	_.postInsertHandler = function() {
		var _this = this;
		this.block = registerCommand(this, '', { editable: true, handlers: {onSave: function() { _this.workspace.updateBookmarks(); } } });
		this.focusableItems = [[this.block]];
		super_.postInsertHandler.call(this);
		this.leftJQ.append('<span class="fa fa-bookmark"></span>');
		return this;
	}
	_.focus = function(dir) {
		super_.focus.call(this);
		if(dir)
			this.block.focus(dir);
		else if(dir === 0) 
			this.block.focus(L);
		else if(!dir && this.focusedItem)
			this.focusedItem.focus();
		return this;
	}
  _.toString = function() {
  	return '{bookmark}{{' + this.argumentList().join('}{') + '}}';
  }
});