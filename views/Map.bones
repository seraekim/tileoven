view = Backbone.View.extend();

view.prototype.events = {
    'change select.maplayer-selection' : 'selectLayer'
};

view.prototype.initialize = function() {
    _(this).bindAll(
        'render',
        'attach',
        'mapZoom',
        'fullscreen',
        'selectLayer'
    );
    this.model.bind('saved', this.attach);
    this.model.bind('poll', this.attach);
    this.render().attach();
};

view.prototype.render = function(init) {
    if (!MM) throw new Error('ModestMaps not found.');

    $(this.el).html(templates.Map());

    this.map = new MM.Map('map',
        new wax.mm.connector(this.model.attributes));

    // Adapted location interaction - opens in new tab
    function locationOn(o) {
        if ((o.e.type === 'mousemove' || !o.e.type)) {
            return;
        } else {
            var loc = o.formatter({ format: 'location' }, o.data);
            if (loc) {
                window.open(loc);
            }
        }
    }

    // Add references to all controls onto the map object.
    // Allows controls to be removed later on.
    this.map.controls = {
        interaction: wax.mm.interaction()
            .map(this.map)
            .tilejson(this.model.attributes)
            .on(wax.tooltip()
                .parent(this.map.parent).events())
            .on({on: locationOn}),
        legend: wax.mm.legend(this.map, this.model.attributes),
        zoombox: wax.mm.zoombox(this.map),
        zoomer: wax.mm.zoomer(this.map).appendTo(this.map.parent),
        fullscreen: wax.mm.fullscreen(this.map).appendTo(this.map.parent)
    };

    // Add image error request handler. "Dedupes" image errors by
    // checking against last received image error so as to not spam
    // the user with the same errors message for every image request.
    this.map.getLayerAt(0).requestManager.addCallback('requesterror', _(function(manager, msg) {
        $.ajax(msg.url, { error: _(function(resp) {
            if (resp.responseText === this._error) return;
            this._error = resp.responseText;
            new views.Modal(resp);
        }).bind(this) });
    }).bind(this));

    var center = this.model.get('center');
    this.map.setCenterZoom(new MM.Location(
        center[1],
        center[0]),
        center[2]);
    this.map.setZoomRange(
        this.model.get('minzoom'),
        this.model.get('maxzoom'));
    this.map.addCallback('zoomed', this.mapZoom);
    this.map.addCallback('panned', this.mapZoom);
    this.map.addCallback('extentset', this.mapZoom);
    this.map.addCallback('resized', this.fullscreen);
    this.mapZoom({element: this.map.div});

    //Change style of zoom display in JS, because doing in style would
    //break tilelots plugin, see: https://github.com/florianf/tileoven/issues/2
    $("#map .zoom-display").css({
        top: "63px",
        width: "120px"
    });

    return this;
};

// Catch resize events and add a fullscreen class to the
// project element to handle visibility of components.
// Note that the wax fullscreen control sets a body class that
// we cannot use here as it can be stale (e.g. user routes away
// from a fullscreen'd map, leaving a stale class on the body).
view.prototype.fullscreen = function(e) {
    if (this.$('#map').hasClass('wax-fullscreen-map')) {
        $('div.project').addClass('fullscreen');
    } else {
        $('div.project').removeClass('fullscreen');
    }
    this.map.draw();
};

// Set zoom display.
view.prototype.mapZoom = function(e) {
    this.$('.zoom-display .zoom').text(this.map.getZoom());
};

view.prototype.attach = function() {
    var selectedLayer = this.$('select.maplayer-selection').val();
    this._error = '';

    if (selectedLayer !== "project") {
        return;
    }

    var layer = this.map.getLayerAt(0);
    layer.provider.options = layer.provider.options || {};
    layer.provider.options.tiles = this.model.get('tiles');
    layer.provider.options.minzoom = this.model.get('minzoom');
    layer.provider.options.maxzoom = this.model.get('maxzoom');
    layer.setProvider(layer.provider);

    layer.provider.setZoomRange(layer.provider.options.minzoom,
                          layer.provider.options.maxzoom)

    this.map.setZoomRange(layer.provider.options.minzoom,
                          layer.provider.options.maxzoom)

    this.map.controls.interaction.tilejson(this.model.attributes);

    if (this.model.get('legend')) {
        this.map.controls.legend.content(this.model.attributes);
        this.map.controls.legend.appendTo(this.map.parent);
    } else {
        $(this.map.controls.legend.element()).remove();
    }

    this.map.draw();
    this.mapZoom();
};

view.prototype.selectLayer = function() {
    var val = this.$('select.maplayer-selection').val();
    var layer = this.map.getLayerAt(0);

    if (val === "project") {
        layer.provider.options = this.model.attributes;
    }
    else {
        //don't mess with the original ref from the project, simple clone
        var clone = JSON.parse(JSON.stringify(this.map.getLayerAt(0).provider.options));
        clone.tiles[0] = val.toLowerCase();
        layer.provider.options = clone;
    }
    layer.setProvider(layer.provider);
    this.map.draw();
}
