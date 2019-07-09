var DEBUG = false;
var DEBUG_FONT = "12px monospace";
var DEBUG_COLOR = "#0F0"

var DCE_VERSION = "0.1.1"

document.title = "direct canvas v" + DCE_VERSION;

var MS = 2; // min miliseconds between engine update calls

// user defined draw and update callbacks
var CALLBACK_PREDRAW = null;
var CALLBACK_POSTDRAW = null;
var CALLBACK_UPDATE = null;

// RESOURCES is a dictionary which will contain all resources loaded from the
// resource manifest
var RESOURCES = {};
var RESOURCE_COUNT = 0;

// DELTATIME is a global variable that contains the diference in seconds between
// the last two frames
var DELTATIME = 0;
var TOTAL_FRAMES = 0;

var SPRITES = {};
var PHYSICS_SYSTEMS = [];

// test if device supports touch
var IS_TOUCH = (('ontouchstart' in window) || (navigator.msMaxTouchPoints > 0));

var MOUSEX = 0;
var MOUSEY = 0;
var MOUSE_LEFT = false;
var MOUSE_RIGHT = false;

var ACTION_CALLBACK_STACK = [];

var MOUSE_TIMEOUT = 60;
var MOUSE_LEFT_BLOCKED = false;

var TIME_START = 0;

var ABORT_LANUCH = false;

// viewport and display "constants" (may change if user resizes browser)
var VIEWPORT_WIDTH = 0;
var VIEWPORT_HEIGHT = 0;
var VIEWPORT_CENTER = null;
var _CANVAS_OFFSET_X = 0;
var _CANVAS_OFFSET_Y = 0;

var ctx = null;					// canvas graphics context
var canvas = null;				// this should be a canvas dom element
var canvas_container = null;	// this should be a div containing the canvas

var PREFERED_VIEWPORT_SIZE = null;

//--------------------------------------------
// Engine library
//--------------------------------------------

// debug
function dce_elapsed() {
	return Date.now() - TIME_START;
}

function dce_log(tag, txt) {

	var msg = dce_elapsed() + " [" + tag + "]: " + txt;

	if (tag != "DEBUG")
		console.log(msg);
	else
		if (DEBUG)
			console.log(msg);

}

function dce_json_post(url, json, _cb = null) {

	dce_log("DEBUG", "sending: " + data);

	var xhr = new XMLHttpRequest();
	xhr.open("POST", url, true);
	xhr.setRequestHeader("Content-Type", "application/json");
	xhr.onreadystatechange = function () {
	    if (_cb != null && xhr.readyState === 4 && xhr.status === 200)
	        _cb(xhr.responseText);
	};
	xhr.send(data);
}

// rng
var _MAX_UINT32 = (Math.pow(2, 32) - 1);

// returns random float between 0 and 1
function dce_random() {
	return (window.crypto.getRandomValues(new Uint32Array(1))[0]) / _MAX_UINT32;
}

// returns a random int between 0 and max (inclusive)
function dce_random_int(max) {
	return Math.round(dce_random() * max);
}

// returns a random int between from(inclusive) and to(inclusive)
function dce_random_range(from, to) {
	return from + dce_random_int(to - from);
}

// primitive canvas drawing abstractions
function dce_gfx_draw_line(ctx, x1, y1, x2, y2, w, _color = "#FFF") {

	ctx.beginPath();
	ctx.moveTo(x1,y1);
	ctx.lineTo(x2,y2);
	ctx.lineWidth = w;
	ctx.strokeStyle = _color;
	ctx.stroke();
	ctx.closePath();

}

function dce_gfx_draw_rect(ctx, x, y, w, h, lcolor, _fcolor = "#0000", _linew = 1) {


	ctx.rect(x, y, w, h);
	ctx.fillStyle = _fcolor;
	ctx.fill();
	ctx.strokeStyle = lcolor;
	ctx.lineWidth = _linew;
	ctx.stroke();

}

function dce_gfx_draw_text(ctx, txt, x, y, font, color, _center = false) {

	ctx.font = font;
	ctx.fillStyle = color;
	if (_center) {
		var measure = ctx.measureText(txt);
		ctx.fillText(txt, x - (measure.width / 2), y);
	} else
		ctx.fillText(txt, x, y);

}

function dce_gfx_debug_object(ctx, obj) {

	// object must be a rect
	if (!obj.pos || !obj.dim)
		throw new Error("Object must be a rect or contain pos and dim vec2")

	dce_gfx_draw_text(
		ctx,
		"rect: " + 
			obj.pos.x + " " +
			obj.pos.y + " " +
			obj.dim.x + " " +
			obj.dim.y,
		obj.pos.x + 28,
		obj.pos.y + 12,
		DEBUG_FONT,
		"#ff0000"
		);

	dce_gfx_draw_rect(
		ctx,
		obj.pos.x,
		obj.pos.y,
		obj.dim.x,
		obj.dim.y,
		"#F00"
		);
}

// "objects"

// vec2 is an object that represents a 2d vector
// TODO: add useful functions, addition, normalization and other operations
vec2 = function(_x = 0, _y = 0) {

	this.x = _x;
	this.y = _y;

	this.is = function(other) {
		return (this.x == other.x) && (this.y == other.y);
	}

	this.add = function(other) {
		return new vec2(
			this.x + other.x,
			this.y + other.y
			);
	}

	this.add = function(other) {
		return new vec2(
			this.x - other.x,
			this.y - other.y
			);
	}

	this.prod = function(other) {
		return new vec2(
			this.x * other.x,
			this.y * other.y
			);
	}

	this.scalar_prod = function(s) {
		return new vec2(
			this.x * s,
			this.y * s
			);
	}

	this.div = function(other) {
		return new vec2(
			this.x / other.x,
			this.y / other.y
			);
	}

	this.pow = function(n) {
		return new vec2(
			Math.pow(this.x, n),
			Math.pow(this.y, n)
			);
	}

	this.length = function() {
		return Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2));
	}

	this.normalized = function() {
		var _len = this.length();
		if (_len > 0)
			return new vec2(
				this.x / _len,
				this.y / _len
				);
		else
			return new vec2(0, 0);
	}

	this.str = function() {
		return "(" + this.x.toFixed(2) + "," + this.y.toFixed(2) + ")";
	}

	this.clone = function() {
		return new vec2(this.x, this.y);
	}

	this.accelerate = function(other, delta) {
		return new vec2(
			this.x + (other.x * delta),
			this.y + (other.y * delta)
			);
	}

}

// linear interpolation between two vec2
vec2.lerp = function(a,b,t) {
	return new vec2(
		a.x + t * (b.x - a.x),
		a.y + t * (b.y - a.y)
		);
}

vec2.zero = new vec2();

// rect is an object that represents a rectangle, this is useful for detecting
// collision, drawing simple primitives and image bliting
rect = function(
	_pos = vec2.zero,
	_dim = vec2.zero,
	_lcolor = "#FFF",
	_fcolor = "#0000"
	) {

	this.pos = _pos;
	this.dim = _dim;
	this.lcolor = _lcolor;
	this.fcolor = _fcolor;

	this.draw = function(ctx, color) {
		
		dce_gfx_draw_rect(
			ctx,
			this.pos.x,
			this.pos.y,
			this.dim.x,
			this.dim.y,
			this.lcolor,
			this.fcolor
			);

		if(DEBUG) dce_gfx_debug_object(ctx, this);
	}

	this.contains = function(x,y) {
		return (x >= this.pos.x) && (x <= this.pos.x + this.dim.x) &&
			(y >= this.pos.y) && (y <= this.pos.y + this.dim.y);
	}

	this.intersects = function(other) {
		return !(((this.pos.x + this.dim.x) < other.pos.x) || ((other.pos.x + other.dim.x) < this.pos.x) ||
			((this.pos.y + this.dim.y) < other.pos.y) || ((other.pos.y + other.dim.y) < this.pos.y))
	}

	this.str = function() {
		return "r: [ pos: " + this.pos.str() + ", dim: " + this.dim.str() + "]"
	}

	this.clone = function() {
		return new rect(
			this.pos,
			this.dim,
			this.lcolor,
			this.fcolor
			);
	}

}

// sprite is an object that represents an image that we wish to draw & that
// can move or be animated
sprite = function(
	_pos,
	_img,
	_scale,
	_hidden = false
	) {

	this.geom = new rect(
		_pos,
		new vec2(_img.width * _scale, _img.height * _scale)
	);
	this.geom.scale = _scale;
	this.img = _img;
	this.hidden = _hidden;
	this.color = 0;

	this.draw = function(ctx) {

		if(!this.hidden)
			ctx.drawImage(
				this.img,
				this.geom.pos.x,
				this.geom.pos.y,
				this.geom.dim.x,
				this.geom.dim.y
			);

		if(DEBUG) dce_gfx_debug_object(ctx, this.geom);

	}

	this.scale = function(_scale) {
		this.geom.dim.x = this.img.width * _scale;
		this.geom.dim.y = this.img.height * _scale;
		this.geom.scale = _scale
	}

	this.clone = function() {
		return new sprite(
			this.geom.pos,
			this.img,
			this.geom.scale,
			this.hidden
			);
	}

	this.sprite_dce_update_cb = null;
	this.sprite_win_resize_cb = null;
}

// text is an object that represents a floating label to ease text drawing
text = function(
	_text,
	_pos,
	_size,
	_type,
	_color,
	_center = true,
	_hidden = false
	) {

	this.text = _text;
	this.pos = _pos;
	this.size_font = _size + "px " + _type;
	this.color = _color;
	this.center = _center;
	this.hidden = _hidden;

	this.draw = function(ctx) {

		if(this.hidden)
			return;

		dce_gfx_draw_text(
			ctx,
			this.text,
			this.pos.x,
			this.pos.y,
			this.size_font,
			this.color,
			this.hidden
			);
		
	}

	this.clone = function() {
		return new text(
			this.text,
			this.pos,
			this.size,
			this.type,
			this.color,
			this.center,
			this.hidden
			);
	}
}

// pforce is an object which represents a physical force
pforce = function(
	_dir,
	_force
	) {

	this.dir = _dir;
	this.force = _force;

	this.as_vector = function() {
		return this.dir.scalar_prod(this.force);
	}

}

// pobject is an object which is subject to the physics system
//	   _sprite: used mostly for graphics
//     _bb:     bounding box, this will be used for collision detection
//	   _mass:   to calculate the weight
pobject = function(
	_sprite,
	_bb,
	_mass
	) {

	this.sprite = _sprite;
	this.bb = _bb;
	this.acceleration = vec2.zero;
	this.mass = _mass;

	this.draw = function(ctx) {
		this.bb.draw(ctx);
	}

	this._physics_update = function(delta, forces) {

		for (var key in forces)
			this.acceleration = this.acceleration.add(forces[key].as_vector());

		this.bb.pos = this.bb.pos.accelerate(
			this.acceleration,
			delta
			);
	}

}

psystem = function(
	_gravity = 9.8,
	_gravity_dir = new vec2(0, -1)
	) {
	this.pobjs = []

	this.gravity = new pforce(
		_gravity_dir,
		_gravity
		)

	this._physycs_system_update = function(delta) {
		for (var i = this.pobjs.length - 1; i >= 0; i--) {
			var _forces = [];
			_forces.push(this.gravity);
			this.pobjs[i]._physics_update(delta, _forces);
		}
	}
}

//--------------------------------------------
// Engine core
//--------------------------------------------

// this function takes a canvas & container id and starts the engine
// cid: canvas id
// ccid: canvas container id
function dce_attach_canvas(cid, ccid) {

	ctx = null;
	canvas = null;
	canvas_container = null;

	canvas = document.getElementById(cid);
	if(canvas == null) {
		throw new Error("No canvas with id:\"" + cid + "\".");
	}

	canvas_container = document.getElementById(id);
	if(canvas == null) {
		throw new Error("No canvas with id:\"" + id + "\".");
	}

	ctx = canvas.getContext("2d");

}

// this function creates a canvas and a container
// cwidth: desired canvas width
// cheight: desired cavnas height
function dce_setup_canvas(cwidth, cheight) {

	ctx = null;
	canvas = null;
	canvas_container = null;

	// setup canvas
	canvas = document.createElement('canvas');

	canvas.id = "gfxctx";
	canvas.width = cwidth;
	canvas.height = cheight;

	// setup container
	canvas_container = document.createElement('div');

	canvas_container.id = "gfxctx_container";
	canvas_container.style.width = cwidth + "px";
	canvas_container.style.height = cheight + "px";
	canvas_container.style.margin = "0px auto";

	canvas_container.appendChild(canvas);
	document.body.appendChild(canvas_container);

	ctx = canvas.getContext("2d");

}

var _prev_dim = new vec2(-1, -1);
function dce_recalculate_dimensions(w, h) {

	var _first_run = _prev_dim.x == -1 && _prev_dim.y == -1;

	if (_first_run || 
		(_prev_dim.x != w && w <= PREFERED_VIEWPORT_SIZE.x)) {
		canvas_container.style.width = w + "px";
		canvas.width = w;
		VIEWPORT_WIDTH = w;
		_prev_dim.x = w;
	}

	if (_first_run || 
		(_prev_dim.y != h && h <= PREFERED_VIEWPORT_SIZE.y)) {
		canvas_container.style.height = h + "px"; 
		canvas.height = h;
		VIEWPORT_HEIGHT = h;
		_prev_dim.y = w;
	}

	VIEWPORT_CENTER = new vec2(VIEWPORT_WIDTH / 2, VIEWPORT_HEIGHT / 2);

	var _canvas_bb = canvas.getBoundingClientRect();

	_CANVAS_OFFSET_X = _canvas_bb.left;
	_CANVAS_OFFSET_Y = _canvas_bb.top;

	dce_log("DEBUG", "just resized: " + String({
		w: w,
		h: h,
		ccsw: canvas_container.style.width,
		ccsh: canvas_container.style.height,
		cw: canvas.width,
		ch: canvas.height,
		VW: VIEWPORT_WIDTH,
		VH: VIEWPORT_HEIGHT,
		VC: VIEWPORT_CENTER.str()
	}));

}

function dce_draw(timestamp) {

	ctx.clearRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);

	if(CALLBACK_PREDRAW != null)
		CALLBACK_PREDRAW(ctx);

	for (var key in SPRITES)
		SPRITES[key].draw(ctx);

	if(CALLBACK_POSTDRAW != null)
		CALLBACK_POSTDRAW(ctx);

	if(DEBUG) {

		// draw canvas margin
		dce_gfx_draw_rect(
			ctx,
			1, 1,
			VIEWPORT_WIDTH - 1, VIEWPORT_HEIGHT - 1,
			DEBUG_COLOR
			);

		// draw mouse info
		dce_gfx_draw_text(
			ctx,
			MOUSEX + " " + MOUSEY,
			MOUSEX + 28,
			MOUSEY + 12,
			DEBUG_FONT,
			DEBUG_COLOR,
			false
			);

		// horizontal line
		dce_gfx_draw_line(
			ctx,
			0, MOUSEY,
			VIEWPORT_WIDTH, MOUSEY,
			3,
			DEBUG_COLOR
			);

		// vertical line
		dce_gfx_draw_line(
			ctx,
			MOUSEX, 0,
			MOUSEX, VIEWPORT_HEIGHT,
			3,
			DEBUG_COLOR
			);

	}
	window.requestAnimationFrame(dce_draw);

}

//engine update calculates delta time, the time between now and last frame and calls update_cb
var _preime = Date.now();
function dce_update() {

	now = Date.now();
	DELTATIME = (now - _preime) / 1000.0;

	// update physics
	for (var i = PHYSICS_SYSTEMS.length - 1; i >= 0; i--)
		PHYSICS_SYSTEMS[i]._physycs_system_update(DELTATIME);

	// update all sprites
	for(var key in SPRITES)
		if (SPRITES[key].sprite_dce_update_cb)
			SPRITES[key].sprite_dce_update_cb(DELTATIME);

	if(CALLBACK_UPDATE != null)
		CALLBACK_UPDATE(DELTATIME);
	TOTAL_FRAMES++;
	_preime = now;

}

// final step of engine start, call after we are done setting up everything
function dce_launch(_usr_start_cb, _usr_awake_cb = null) {

	if (_usr_awake_cb != null)
		_usr_awake_cb();

	_usr_start_cb();

	if(ABORT_LANUCH)
		return;

	setInterval(dce_update, MS);
	window.requestAnimationFrame(dce_draw);

}

//dce_init loads resources and then calls _usr_start_cb
function dce_init(
	_usr_start_cb, 
	resource_manifest = {},
	_usr_awake_cb = null,
	_usr_update_cb = null,
	_usr_predraw_cb = null,
	_usr_postdraw_cb = null
	) {

	CALLBACK_UPDATE = _usr_update_cb;
	CALLBACK_PREDRAW = _usr_predraw_cb;
	CALLBACK_POSTDRAW = _usr_postdraw_cb;

	if (canvas == null || canvas_container == null)
		throw new Error("Called engine init without an attached canvas.")

	dce_log("DEBUG", "dce_init " + canvas.width + "x" + canvas.height);

	dce_recalculate_dimensions(canvas.width, canvas.height);

	// input event listeners
	if(IS_TOUCH)
		window.addEventListener('touchstart', function(e) {
			e.preventDefault();
			MOUSEX = e.pageX;
			MOUSEY = e.pageY;
			for (var i = ACTION_CALLBACK_STACK.length - 1; i >= 0; i--) {
				ACTION_CALLBACK_STACK[i]();
			}
		}, { passive: false });
	else {
		window.addEventListener('mousemove', function(e) {
			e.preventDefault();
			MOUSEX = e.clientX - _CANVAS_OFFSET_X;
			MOUSEY = e.clientY - _CANVAS_OFFSET_Y;
		}, { passive: false });

		window.addEventListener('mousedown', function(e) {
			e.preventDefault();
			for (var i = ACTION_CALLBACK_STACK.length - 1; i >= 0; i--) {
				ACTION_CALLBACK_STACK[i]();
			}
		}, { passive: false });
	}

	// disable menu on right click
	window.addEventListener('contextmenu', function(e) {
		e.preventDefault();
		return false;
	}, { passive: false });

	dce_log("DEBUG", "registered mouse & touch events.")

	window.addEventListener('resize', function(e) {
		dce_recalculate_dimensions(document.body.clientWidth, document.body.clientHeight);
	}, { passive: false });

	dce_log("DEBUG", "registered resize event.")

	// check if we have to load resources
	if (resource_manifest != null)
		RESOURCE_COUNT = Object.keys(resource_manifest).length;
	else {
		dce_log("DEBUG", "no resources, launching engine as is.");
		dce_launch(_usr_start_cb, _usr_awake_cb);
		return;
	}

	dce_log("DEBUG", "about to start loading " + RESOURCE_COUNT + " resource files.");

	var loaded_res = 0;
	for(var key in resource_manifest){
		resource_path = resource_manifest[key];
		update_load = function() {
			loaded_res += 1;
			if(DEBUG) console.log("\t" + loaded_res + "/" + RESOURCE_COUNT + " | \"" + resource_path + "\"");
			if(loaded_res == RESOURCE_COUNT)
				dce_launch(_usr_start_cb, _usr_awake_cb);
		}

		// get type of file, supported files: images & mp3
		var splt_path = resource_path.split('.');
		var type = splt_path[splt_path.length - 1];

		dce_log("DEBUG", "trying to load a/an " + type + " file @ " + resource_path);

		if(type === "mp3") {

			RESOURCES[key] = new Audio(resource_path);
			update_load();

		} else {

			RESOURCES[key] = new Image();
			RESOURCES[key].onload = update_load;
			RESOURCES[key].src = resource_path;

		}
	}

}