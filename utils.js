define(function(require, exports, module) {
    main.consumes = ["menus", "Plugin"];
    main.provides = ["cs50.utils"];
    return main;

    function main(options, imports, register) {
        var menus = imports.menus;
        var Plugin = imports.Plugin;

        var plugin = new Plugin("CS50", main.consumes);

        function showMenuItem(path, visible) {
            var item = menus.get(path).item;
            if (item)
                item.setAttribute("visible", visible);
        }

        plugin.freezePublicAPI({
            showMenuItem: showMenuItem
        });

        register(null, { "cs50.utils": plugin });
    }
});
