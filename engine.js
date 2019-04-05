//To enable debug information set "DEBUG" to true
var DEBUG = false;

//Canvas creation & initialization
//--------------------------------------------
var canvas = document.createElement('canvas');

canvas.id = "gfxctx";
canvas.style.width = "100%";
canvas.style.height = "100%";
canvas.width = document.body.clientWidth;
canvas.height = document.body.clientHeight;


document.body.appendChild(canvas);
//--------------------------------------------

//Engine library
//--------------------------------------------

//vec2 is an object that represents a 2d vector
//TODO: add useful functions, addition, normalization and other operations
vec2 = function(_x,_y) {
	this.x = _x;
	this.y = _y;

	this.copy = function() {
		return new vec2(this.x, this.y)
	}
}

//linear interpolation between two vec2
vec2.lerp = function(a,b,t) {
	return new vec2(
		a.x + t * (b.x - a.x),
		a.y + t * (b.y - a.y)
	);
}

//rect is an object that represents a rectangle, this is useful for detecting
//collision, drawing simple primitives and image bliting
rect = function(_position, _dim) {
	this.position = _position;
	this.dim = _dim;

	this.draw = function(ctx, color) {
		fstyle = ctx.fillStyle;
		ctx.fillStyle = color;
		ctx.fillRect(
			this.position.x,
			this.position.y,
			this.dim.x,
			this.dim.y
		);
		ctx.fillStyle = fstyle;

		if(DEBUG) {
			oldfont = ctx.font;
			ctx.font = "12px monospace"
			ctx.fillStyle = '#ff0000';
			ctx.fillText(
				"rect: " + 
					this.position.x + " " +
					this.position.y + " " +
					this.dim.x + " " +
					this.dim.y, 
				this.position.x + 28, 
				this.position.y + 12);

			ctx.beginPath();
			ctx.strokeStyle="red";
			ctx.rect(
				this.position.x,
				this.position.y,
				this.dim.x,
				this.dim.y
			);
			ctx.stroke();

			ctx.font = oldfont;
		}
	}

	this.contains = function(x,y) {
		return (x >= this.position.x) && (x <= this.position.x + this.dim.x) &&
			(y >= this.position.y) && (y <= this.position.y + this.dim.y);
	}

	this.intersects = function(other) {
		return !(((this.position.x + this.dim.x) < other.position.x) || ((other.position.x + other.dim.x) < this.position.x) ||
			((this.position.y + this.dim.y) < other.position.y) || ((other.position.y + other.dim.y) < this.position.y))
	}

	this.copy = function() {
		return new rect(
			this.position.copy(),
			this.dim.copy()
		);
	}
}

//sprite is an object that represents an image that we wish to draw & that
//can move or be animated
//TODO: add custom update logic in a per sprite basis
sprite = function(position, _img, _scale, _hidden) {

	this.geom = new rect(
		position,
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
				this.geom.position.x,
				this.geom.position.y,
				this.geom.dim.x,
				this.geom.dim.y
			);

		if(DEBUG) {
			oldfont = ctx.font;
			ctx.font = "12px monospace"
			ctx.fillStyle = '#ff0000';
			ctx.fillText(
				"sprite: " + 
					this.geom.position.x + " " +
					this.geom.position.y + " " +
					this.geom.dim.x + " " +
					this.geom.dim.y, 
				this.geom.position.x + 28, 
				this.geom.position.y + 12);

			ctx.beginPath();
			ctx.strokeStyle="red";
			ctx.rect(
				this.geom.position.x,
				this.geom.position.y,
				this.geom.dim.x,
				this.geom.dim.y
			);
			ctx.stroke();

			ctx.font = oldfont;
		}
	}

	this.scale = function(_scale) {
		this.geom.dim.x = this.img.width * _scale;
		this.geom.dim.y = this.img.height * _scale;
		this.geom.scale = _scale
	}
}

//--------------------------------------------

//Engine core
//--------------------------------------------

//min miliseconds between engine update calls
var MS = 2;
//user defined draw and update callbacks
var CALLBACK_PREDRAW = null;
var CALLBACK_POSTDRAW = null;
var CALLBACK_UPDATE = null;

//RESOURCES is a dictionary which will contain all resources loaded from the
//resource manifest
var RESOURCES = {};
var RESOURCE_COUNT = 0;

//DELTATIME is a global variable that contains the diference in seconds between
//the last two frames
var DELTATIME = 0;
var TOTAL_FRAMES = 0;

var SPRITES = {};
var VIEWPORT_WIDTH = canvas.width;
var VIEWPORT_HEIGHT = canvas.height;

var MOUSEX = 0;
var MOUSEY = 0;
var MOUSE_LEFT = false;
var MOUSE_RIGHT = false;

var ACTION_CALLBACK_STACK = [];

var MOUSE_TIMEOUT = 60;
var MOUSE_LEFT_BLOCKED = false;

var TIME_START = 0;

var ABORT_LANUCH = false;

var ctx = canvas.getContext("2d");
function engine_draw(timestamp) {

	ctx.clearRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);

	if(CALLBACK_PREDRAW != null)
		CALLBACK_PREDRAW(ctx);

	for (var key in SPRITES) {
		SPRITES[key].draw(ctx);
	}

	if(CALLBACK_POSTDRAW != null)
		CALLBACK_POSTDRAW(ctx);

	if(DEBUG) {

		oldfont = ctx.font;
		ctx.font = "12px monospace"
		ctx.fillStyle = '#ff0000';
		ctx.fillText(MOUSEX + " " + MOUSEY + " " + MOUSE_LEFT + " " + MOUSE_RIGHT, MOUSEX + 28, MOUSEY + 12);

		//Draw mouse info
		ctx.beginPath();
		ctx.moveTo(MOUSEX,0);
		ctx.lineTo(MOUSEX,VIEWPORT_HEIGHT);
		ctx.strokeStyle = '#ff0000';
		ctx.stroke();
		ctx.beginPath();
		ctx.moveTo(0,MOUSEY);
		ctx.lineTo(VIEWPORT_WIDTH,MOUSEY);
		ctx.strokeStyle = '#ff0000';
		ctx.stroke();

		ctx.font = oldfont;

	}
	window.requestAnimationFrame(engine_draw);

}

//engine update calculates delta time, the time between now and last frame and calls update_cb
var _preime = Date.now();
function engine_update() {

	//Update body and viewport dimensions
	canvas.width = document.body.clientWidth;
	canvas.height = document.body.clientHeight;
	VIEWPORT_WIDTH = canvas.width;
	VIEWPORT_HEIGHT = canvas.height;

	now = Date.now();
	DELTATIME = (now - _preime) / 1000.0;
	if(CALLBACK_UPDATE)
		CALLBACK_UPDATE(DELTATIME);
	TOTAL_FRAMES++;
	_preime = now;
}

//engine_init loads resources and then calls start_cb
function engine_init(resource_manifest, start_cb, update_cb, predraw_cb, postdraw_cb) {

	if(DEBUG) console.log("engine_init " + canvas.width + "x" + canvas.height);


	/*
	window.addEventListener('mousemove', function(e) {
		e.preventDefault();
		MOUSEX = e.clientX - document.body.offsetLeft;
		MOUSEY = e.clientY - document.body.offsetTop;
	}, true);*/

	/*
	window.addEventListener('mousedown', function(e) {
		e.preventDefault();
		if(e.button == 0) {
			MOUSE_LEFT_BLOCKED = true
			setTimeout(function() { MOUSE_LEFT_BLOCKED = false; }, MOUSE_TIMEOUT);

			for (var i = ACTION_CALLBACK_STACK.length - 1; i >= 0; i--) {
				ACTION_CALLBACK_STACK[i]();
			}
		}
		MOUSE_LEFT = e.button == 0;
		MOUSE_RIGHT = e.button == 2;
	}, true);*/

	window.addEventListener('touchstart', function(e) {
		//e.preventDefault();
		MOUSEX = e.changedTouches[0].pageX;
		MOUSEY = e.changedTouches[0].pageY;
		for (var i = ACTION_CALLBACK_STACK.length - 1; i >= 0; i--) {
			ACTION_CALLBACK_STACK[i]();
		}
	}, false);

	/*
	window.addEventListener('mouseup', function(e) {
		e.preventDefault();
		if(e.button == 0)
			MOUSE_LEFT = false;
		if(e.button == 2)
			MOUSE_RIGHT = false;
	}, true);*/

	window.addEventListener('contextmenu', function(e) {
		e.preventDefault();
		return false;
	}, true);

	if(DEBUG) console.log("registered mouse & touch events.")

	//finally load resources and when finished, call start_cb, and start the engine_update loop
	RESOURCE_COUNT = Object.keys(resource_manifest).length;

	if(RESOURCE_COUNT == 0) {
		if(DEBUG) console.log("no resources, launching engine as is.");
		start_cb();
		if(ABORT_LANUCH)
			return;
		CALLBACK_UPDATE = update_cb;
		CALLBACK_PREDRAW = predraw_cb;
		CALLBACK_POSTDRAW = postdraw_cb;
		setInterval(engine_update, MS);
		window.requestAnimationFrame(engine_draw);
		return;
	}

	if(DEBUG) console.log("about to start loading " + RESOURCE_COUNT + " resource files.");

	var res_count = 0;
	for(var key in resource_manifest){
		resource_path = resource_manifest[key];
		update_load = function() {
			res_count += 1;
			if(DEBUG) { 
				if(res_count == 1)
					console.log("resource_manifest: ");

				console.log("\t" + res_count + "/" + RESOURCE_COUNT + " | \"" + resource_path + "\"");
			}
			if(res_count == RESOURCE_COUNT) {
				start_cb();				
				if(ABORT_LANUCH)
					return;
				CALLBACK_UPDATE = update_cb;
				CALLBACK_PREDRAW = predraw_cb;
				CALLBACK_POSTDRAW = postdraw_cb;
				setInterval(engine_update, MS);
				TIME_START = Date.now();
				if(DEBUG) { console.log("time0: "+TIME_START);}
				window.requestAnimationFrame(engine_draw);
			}
		}

		splt_path = resource_path.split('.');
		type = splt_path[splt_path.length - 1];
		if(DEBUG) console.log("trying to load a/an " + type + " file @ " + resource_path);
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

function random_int(max) {
  return Math.floor(Math.random() * Math.floor(max));
}

function elem_in_array(target, array) {
	for(var i = 0; i < array.length; i++){
		if(array[i] === target) {
			return true;
    	}
  	}
  	return false; 
}

function send_json_post(url, data, cb) {
	console.log("sending: " + data)
	var xhr = new XMLHttpRequest();
	xhr.open("POST", url, true);
	xhr.setRequestHeader("Content-Type", "application/json");
	xhr.onreadystatechange = function () {
	    if (xhr.readyState === 4 && xhr.status === 200)
	        cb(xhr.responseText);
	};
	xhr.send(data);
}

function time_elapsed() {
	return Date.now() - TIME_START;
}


function timestamp(){
	var date= new Date();
	var dateString = Date.now();
	dateString = date.getFullYear()+"-"+
   	(date.getMonth()+1)+"-"+
   	date.getDate()+" "+
   	date.getHours()+":"+ 
   	date.getMinutes()+":"+
   	date.getSeconds();
	return(dateString)
}