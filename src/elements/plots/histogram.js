var plot_histogram = P(barplot, function(_, super_) {
	_.plot_type = 'plot_histogram';
	_.c3_type = 'bar';
	_.helpText = "<<histogram plot>>\nPlot a Histogram based on data.  To alter the default binning, enter the number of requested bins.";

	_.innerHtml = function() {
		return super_.innerHtml.call(this).replace('YIELD','<div class="' + css_prefix + 'focusableItems" data-id="2">data:&nbsp;' + focusableHTML('MathQuill',  'eq1') + '</div><div class="' + css_prefix + 'focusableItems" data-id="3">bins:&nbsp;' + focusableHTML('MathQuill',  'bins') + '</div>');
	}
	_.postInsertHandler = function() {
		this.eq1 = registerFocusable(MathQuill, this, 'eq1', { ghost: 'y data', handlers: {
			enter: this.enterPressed(this),
			blur: this.submissionHandler(this)
		}});
		this.bins = registerFocusable(MathQuill, this, 'bins', { ghost: 'default', default: '10', handlers: {
			enter: this.enterPressed(this),
			blur: this.submissionHandler(this)
		}});
		this.focusableItems = [[this.eq1],[this.bins]];
		super_.postInsertHandler.call(this);
		var _this = this;
		this.leftJQ.append('<span class="fa fa-bar-chart"></span>');
	}
	_.createCommands = function() {
		this.plot_me = false;
		return [
			{command: "latex(evalf(mksa_base(" + this.eq1.text() + "[0])))", nomarkup: true},
			{command: "histogram(mksa_remove(evalf(" + this.eq1.text() + ")),evalf(" + this.bins.text() + "))", nomarkup: true}
		];
	}
	_.evaluationFinished = function(result) {
		if(result[1].success) {
			this.x_unit = result[0].returned;
			try {
				var hist = result[1].returned.replace(/[^0-9\.\-,e\[\]]/g,''); // Remove non-numeric characters
				hist = hist.replace(/,,/g,',null,').replace('[,','[null,').replace(',]',',null]');
				if(!hist.match(/[0-9]/)) {
					this.outputBox.setWarning('No numeric results were returned and nothing will be plotted').expand();
					return true;
				}
				hist = eval(hist);
				var bins = [];
				var freqs = [];
				for(var i = 0; i < hist.length; i++) {
					bins.push([(hist[i][0] / this.parent.x_unit_conversion),(hist[i][1] / this.parent.x_unit_conversion)]);
					freqs.push(hist[i][2]);
				}
				freqs.unshift('data_' + this.id);
				this.ys = freqs;
				this.x_labels = bins;
				this.plot_me = true;
				this.outputBox.clearState().collapse();
			} catch(e) {
				this.outputBox.setError('Error evaluating function: Non-numeric results were returned and could not be plotted').expand();
			}
		} else {
			this.outputBox.setError(result[1].returned).expand();
		}
		return true;
	}
});