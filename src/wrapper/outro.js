
	SwiftCalcs.Worksheet = Worksheet;
	var elements = SwiftCalcs.elements = {
		'math': math,
		'text': text,
		'if': if_block,
		'else': else_block,
		'elseif': else_if_block,
		'for': for_loop,
		'continue': continue_block,
		'break': break_block,
		'plot': plot,
		'plot_func': plot_func,
		'plot_line': plot_line,
		'plot_line_stacked': plot_line_stacked,
		'plot_area': plot_area,
		'plot_area_stacked': plot_area_stacked,
		'plot_scatter': plot_scatter,
		'plot_bar_stacked': plot_bar_stacked,
		'plot_bar': plot_bar,
		'plot_histogram': plot_histogram,
		'bookmark': bookmark,
		'solve': solve,
		'desolve': desolve,
		'regression': regression,
		'import': importData,
		'image': image,
		'imageBlock': imageBlock,
		'csv': csv,
		'csvBlock': csvBlock,
		'video': video,
		'videoBlock': videoBlock,
	}
	for(var i = 0; i < giac_elements_to_add.length; i++) 
		elements[giac_elements_to_add[i].key] = SwiftCalcs.elements[giac_elements_to_add[i].key] = giac_elements_to_add[i].el;
}());
