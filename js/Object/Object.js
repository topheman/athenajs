import FX from 'FX/FX';
import Behaviors from 'Object/Behavior/Behaviors';
import Input from 'Input/InputManager';
import AM from 'Audio/AudioManager';
import Deferred from 'Core/Deferred';

/*jshint devel: true, bitwise: false*/
/*globals Class*/
/**
 * `GfxObject` is the base class for objects that can be rendered on the screen.
 * 
 * A `GfxObject` has properties like x, y, vx, vy, speed.
 * In order to be rendered, an object must be added onto the active scene/map.
 * It can also have an optional behavior which tells Athena how
 * to move an object at each frame.
 * 
 * @param {string} type The type of object: this describes the type of object
 * @param {Object} options
 * @param {string} [options.objectId] The id of the object. The defaults is type + random timestamp.
 * @param {number} [options.collideGroup=0] The type of collision to use for the object.
 * @param {boolean} [options.master=false] Set to true if the object should be the master.
 * @param {boolean} [options.visible=true] An invisible object isn't rendered onto the screen.
 */
class GfxObject {
  constructor(type, options) {
    this.type = type;
    this.id = options.objectId || (this.type + new Date().getTime());

    this.currentMap = null;
    this.currentScene = null;

    // can be used to delay object destroy
    this._destroyed = false;

    this.children = [];

    this.wave = options.wave || null;

    this.behavior = null;

    // is player on a platform ?
    this.platform = null;

    // 0 == master (player)
    // 1 == enemies (inc. enemy bullets, gems, bonuses,...)
    // 2 == friend bullets
    this.collideGroup = options.collideGroup || 0;
    this.canCollideFriendBullet = options.canCollideFriendBullet || false;

    this.master = options.master || false;

    if (options.behavior) {
      console.log('need to set move to', options.behavior);
      this.setBehavior(options.behavior, options.behaviorOptions);
    }

    // save settings for re-use
    this._settings = Object.assign({
      speed: 1,
      visible: true,
      canCollide: false,
      plane: 0,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      scale: 1.0,
      angle: 0,
      moving: true,
      gravity: 0,
      data: {},
      path: null,
      target: null,
      targetOffsetX: 0,
      targetOffsetY: 0,
      wave: options.wave || null
    }, options);
    /*            {
            speed: options.speed || 1,
            visible: options.visible || true,
            canCollide: options.canCollide || false,
            plane: options.plane || 0,
            x: options.x || 0,
            y: options.y || 0,
            scale: options.scale || 1.0,
            angle: 0,
            moving: typeof options.moving !== 'undefined' ? options.moving : true,
            gravity: typeof options.gravity !== 'undefined' ? options.gravity : 0,
            data: options.data || {},
            path: null,
                    target: options.target || null,
                    targetOffsetX: options.targetOffsetX || 0,
                    targetOffsetY: options.targetOffsetY || 0
          };*/

    // this._data = options.data || {};
    // console.log('settings set', this._settings);

    this.target = null;

    this.spline = null;

    this.currentMovement = '';

    this.fxQueue = {};

    if (!options.pool) {
      // only set option if not from pool since pool elements are intantiated with
      // fake data: we don't want to reset them yet
      this.reset();

      if (options.animate) {
        this.animate(options.animate.name, options.animate.options);
      }
    }

    if (options.scene) {
      debugger;
      options.scene.addObject(this);
      return;
    } else if (options.map) {
      debugger;
      return;
      options.map.addObject(this);
    }
  }

  /**
   * Resets the map, used when player lost for example.
   * 
   * `speed`,  `visible`, `canCollide`, `plane`, `x`, `y`, `scale`, `angle`, `moving`,
   * `vx` , `vy`, `gravity`, `wave`
   * 
   */
  reset() {
    this.speed = this._settings.speed;
    this.visible = this._settings.visible;
    this.canCollide = this._settings.canCollide;
    this.plane = this._settings.plane;
    this.x = this._settings.x;
    this.y = this._settings.y;
    this.scale = this._settings.scale;
    this.angle = this._settings.angle;
    this.moving = this._settings.moving;

    this.data = this._settings.data;

    this.path = null;

    this.vx = this._settings.vx || 0;
    this.vy = this._settings.vy || 0;

    this.gravity = this._settings.gravity;

    // handlers
    this.moveHandlers = [];

    this.targetOffsetX = this._settings.targetOffsetX || 0;
    this.targetOffsetY = this._settings.targetOffsetY || 0;
    this.target = this._settings.target || null;

    this.savedX = this.x;
    this.savedY = this.y;

    this.wave = this._settings.wave;
  }

  /**
   * Sets the map of the object.
   * 
   * @param {Map} map The map of the object.
   * 
   * @note you don't usually need to call this method as it's called automatically when adding an object
   * onto a map.
   * 
   */
  setMap(map) {
    this.currentMap = map;

    this.children.forEach((child) => {
      child.setMap(map);
    });
  }

  /**
   * Sets the scene of the object.
   * 
   * @param {Scene} scene The scene of the object.
   * 
   * @note you don't usually need to call this method as it's called when adding an object onto a scene.
   */
  setScene(scene) {
    this.currentScene = scene;

    this.children.forEach((child) => {
      child.setScene(scene);
    });
  }

  /**
   * WIP Sets the platform of the object. This will be used when platforms will be fully implemented.
   * 
   * @param {GfxObject} platform The platform the object is attached to.
   */
  setPlatform(platform) {
    this.platform = platform;
  }

  /**
   * Moves the object to a new destination.
   * 
   * @param {number} The new horizontal position.
   * @param {number} The new vertical position.
   * 
   * @returns {GfxObject} this
   */
  moveTo(x, y) {
    this.x = x;
    this.y = y;
    this._onMove();

    return this;
  }

  /**
   * Centers the object into the scene.
   * 
   * @returns {GfxObject} this
   */
  center() {
    let display = this.currentScene.display;

    this.x = (display.width - this.w) / 2;
    this.y = (display.height - this.h) / 2;
    return this;
  }

  /**
   * Sets a new behavior to the object: this will be called in the move loop
   * 
   * @param {String} name The name of the behavior to use.
   * @param {Object} options The options of the behavior (may depend on the behavior type)
   * 
   * @related {Behavior}
   */
  setBehavior(name, options) {
    this.behavior = new (Behaviors.getBehavior(name))(this, Input, options);
  }

  /**
   * You can call clearBehavior if you want to stop using a particular behavior.
   * 
   * The vx and vy properties of the object will be set to zero.
   */
  clearBehavior() {
    this.vx = this.vy = 0;
    this.behavior = null;
  }

  /**
   * Called on each move loop and used to move the object using its (optional) behavior or its
   * vx and vy properties.
   * 
   * @private
   */
  move() {
    if (this.moving) {
      if (!this.behavior) {
        // TODO: check map to see if we can move
        this.x += this.vx;
        this.y += this.vy;

        // gravity impacts velocity
        this.vy -= this.gravity;
      } else {
        this.behavior.onMove();
      }

      if (this.children.length) {
        this.children.forEach((child) => {
          child.move();
        });
      }

      // TODO: check map to see if we can move
      /*                this.x += this.vx;
                  this.y += this.vy;                */
    }
  }

  /**
   * Saves current object position into `savedX` and `savedY` properties
   */
  savePosition() {
    this.savedX = this.x;
    this.savedY = this.y;
  }

  /**
   * Returns previously seved position
   * 
   * @returns {Object} The saved position
   */
  getSavedPosition() {
    return {
      x: this.savedX,
      y: this.savedY
    };
  }

  /**
   * NOT IMPLEMENTED
   * 
   * @private
   */
  moveWithSpline(/*speed*/) {

  }

  /**
   * Sets a new path for the object
   * 
   * @param {Path} path The new path that the object will use when moving.
   * 
   * @related {Path}
   */
  setPath(path) {
    this.path = path;
  }

  /**
   * Change the scale of the object
   * 
   * @param {number} scale The new scale of the object.
   * 
   * @note: it's only used when rendering, collision detection is not using the scale yet.
   */
  setScale(scale) {
    this.scale = scale;
  }

  /**
   * Change the angle of an object
   * 
   * @param {number} angle The new angle of the object. 0 < angle < 360
   * 
   * @note This property is only used for the rendering and it's ignored for collisions.
   */
  setAngle(angle) {
    // this.angle = angle * Math.PI / 180;
    this.angle = angle;
  }

  /**
   * Returns the angle property of the object.
   */
  getAngle() {
    return this.angle;
    // return 180 * this.angle / Math.PI;
  }

  /**
   * WIP Performs a transformation on the object
   * 
   * @private
   */
  transform(type, value) {
    switch (type) {
      case 'scale':
        this.scale = value;
        break;
    }
  }

  /**
   * Hides the object
   * 
   * @returns {GfxObject} this
   */
  hide() {
    this.visible = false;

    return this;
  }

  /**
   * Show the object
   * 
   * @returns {GfxObject} this
   */
  show() {
    this.visible = true;

    return this;
  }

  /**
   * Returns the current width of the object: with some types of GfxObjects ({Sprite}),
   * width can vary
   * 
   * @returns {number} The current width of the object
   * 
   * @related {Sprite}
   */
  getCurrentWidth() {
    return this.width;
  }

  /**
   * Returns the current height of the object: with some types of GfxObjects ({Sprite}),
   * height can vary
   * 
   * @returns {number} The current height of the object
   * 
   * @related {Sprite}
   */
  getCurrentHeight() {
    return this.height;
  }

  // TODO: should return the type of sprite ?
  // TODO: should check map ?
  // TODO: handle scale/rotation here !!
  /**
   * Performs collision tests on the specifed object.
   * 
   * @param {GfxObject} obj The object to perform test on
   * 
   * @returns {Boolean} Returns true if this and obj collide
   */
  hitTest(obj) {
    let hitBox = obj.getHitBox(),
      found = false;

    if (this.canCollide && obj.canCollide && this !== obj && this.visible) {
      let spriteHitBox = this.getHitBox(),
        box = {
          x: this.x + spriteHitBox.x,
          y: this.y + spriteHitBox.y,
          x2: this.x + spriteHitBox.x + spriteHitBox.x2,
          y2: this.y + spriteHitBox.y2 + spriteHitBox.y
        };

      if ((box.y < obj.y + hitBox.y && box.y2 > obj.y + hitBox.y) || (box.y > obj.y + hitBox.y && box.y < obj.y + hitBox.y + hitBox.y2)) {
        if ((box.x < obj.x + hitBox.x && box.x2 > obj.x + hitBox.x) || (box.x > obj.x + hitBox.x && box.x < obj.x + hitBox.x + hitBox.x2)) {
          // console.log('collision detected with', sprite.id);
          obj.onCollision(this);
          this.onCollision(obj);

          found = true;
        }
      }
    }

    if (!found) {
      let max = this.children.length,
        i = 0;

      while (!found && i < max) {
        found = this.children[i].hitTest(obj);
        i++;
      }
    }
    return found;
  }

  /**
   * WIP: Set a new target for the object
   * 
   * It's planned to have the ability for objects to follow other objects, for example:
   * homing missiles, etc...
   * 
   * @private
   */
  setTarget(obj) {
    this.target = obj;
  }

  /**
   * Add a new handler to be called after each move of the object
   * 
   * @param {Function} cb The callback to add
   */
  addMoveHandler(cb) {
    this.moveHandlers.push(cb);
  }

  /**
   * onHit is called when the object collides with another object
   * 
   * @param {GfxObject} obj The object that collided.
   * 
   * This function does nothing interesting: this should be extended if needed.
   */
  onHit(obj) {
    console.log('[GfxObject] oops, ', this.type, ' [', this.id, '] ', 'was hit by', obj.name, ' [', obj.id, ']');
  }

  /**
   * INTERNAL: calls move handles
   * 
   * @private
   */
  _onMove() {
    const args = [this.x, this.y];
    this.moveHandlers.forEach((callback) => callback(...args));
  }

  /**
   * INTERNAL: checks if object fx queue is empty
   * 
   * @returns {Boolean} True if the queue is empty, false otherwise.
   * 
   * @private
   */
  isFxQueueEmpty() {
    for (var i in this.fxQueue) {
      return false;
    }
    
    return true;
  }

  /**
   * Performs an animation on the object using one of the defined {FX} effects
   * 
   * Effects change the object size/position using an interpolation function.
   * 
   * Athena has the following effects:
   * - {Fade} performs a fade
   * - {Mosaic} performs a SNES-like mosaic effect
   * - {Rotate} performs a rotation on the object
   *
   * @param {String} fxName the name of the effect to use.
   * @param {Object} options the options of the effect.
   * @param {String} [options.easing="linear"] The easing functions to use, can be: 'linear', 'swing', 'easeInQuad', 'easeOutBounce'.
   * 
   * @returns {Promise} a promise that will be fullfilled when the effect has been completed
   */
  animate(fxName, options) {
    // console.log('animate');
    let fxClass = FX.getEffect(fxName),
      promise = new Deferred().resolve(),
      easing = options.easing || 'linear',
      fx;

    if (typeof this.fxQueue[fxName] !== 'undefined') {
      console.warn('Fx', fxName, 'already in progress, cannot execute twice');
    } else if (!fxClass) {
      console.warn('Fx', fxName, 'unknown: did you spell it correctly ?');
    } else {
      fx = new fxClass(options);
      fx.setEasing(new FX.getEasing(easing));

      promise = fx.start().then(() => {
        // console.log('effect ended, need to stop it', fxName);
        delete this.fxQueue[fxName];
      });

      this.fxQueue[fxName] = fx;
    }

    return promise;
  }

  /**
   * Stop current running animation
   * 
   * In some cases, the game may need to stop effects from running before
   * they are completed. This method proves a way to do so and set an end value.
   * 
   * @param {any} The end value of the animation
   */
  stopAnimate(setEndValue) {
    let fxObject = null;

    // console.log('need to stop animation');
    Object.keys(this.fxQueue).forEach((fxName) => {
      fxObject = this.fxQueue[fxName];

      fxObject.stop(setEndValue);
    });
    // for (let fxName in this.fxQueue) {

    // }
  }

  /**
   * Perform each fx remaining in the fxQueue
   * 
   * @param {CanvasContext} ctx Where to perform the rendering.
   * @param {number} time The current time ellapsed since fx queue was started.
   * 
   * @private
   */
  executeFx(ctx, time) {
    let fxObject = null;

    Object.keys(this.fxQueue).forEach((fxName) => {
      fxObject = this.fxQueue[fxName];

      fxObject.process(ctx, null, this, time);
    });
    // for (var fxName in this.fxQueue) {
    //     fxObject = this.fxQueue[fxName];

    //     fxObject.process(ctx, null, this, time);
    // }
  }

  /**
   * onCollision is called on each collision with the object.
   * 
   * This method does nothing and should be extended if needed.
   * 
   */
  onCollision() {
    //console.log('onCollision does nothing by default');
  }

  /**
   * Add a new Child to the object.
   * 
   * Childs are automatically rendered and moved when the parent object is.
   * 
   * @param {GfxObject} child The child to add.
   * 
   * @note children are automatically added to the scene/map of the parent object.
   */
  addChild(child) {
    child.setMap(this.currentMap);
    child.setScene(this.currentScene);

    this.children.push(child);
  }

  /**
   * Remove a child from the object
   * 
   * @param {GfxObject} child The child to remove from the object.
   * 
   * @note: removing a child object will call its `destroy` method
   */
  removeChild(child) {
    let idx = this.children.indexOf(child);

    if (idx > -1) {
      this.children[idx].destroy();
      this.children.splice(idx, 1);
    }
  }

  /**
   * Remove every children from the object
   */
  removeAllChildren() {
    for (let i = 0; i < this.children.length; ++i) {
      this.children[i].destroy();
    }
    this.children.length = 0;
  }

  /**
   * This method is called when drawing an object
   * 
   * GfxObject is a virtual object so its drawing method does nothing
   * 
   * Every Object inheriting from GfxObject should implement its own draw method.
   * 
   * @param {CanvasContext} destCtx the target canvas rendering context.
   * @param {Boolean} debug Debug is set to true if the game is being debugged.
   */
  draw(destCtx, debug) {
    console.error('[GfxObject] you need to define a draw method for your object, GfxObjects do not have a draw method');
  }

  /**
   * Plays the spcified sound
   * 
   * @param {String} id The id of the sound to play
   * @param {Object} options
   * @param {Boolean} [options.pan=true] Set pan to true if you want to use panning.
   * @param {Boolean} [options.loop=false] Set to true to loop the sound.
   */
  playSound(id, options) {
    let panning = 0,
      map = this.currentMap,
      volume = 1.0,
      opt = options || {
        pan: true,
        loop: false
      };

    // volume: outside of screen = volume down
    if (map && (this.x < -map.viewportX || this.x > -map.viewportX + map.viewportW) || (this.y < -map.viewportY || this.y > -map.viewportY + map.viewportH)) {
      volume = 0.2;
    }

    // panning depends on player position
    if (map && opt.pan) {
      panning = this.x < map.masterObject.x ? -5 : 5;
    }

    this.sound = AM.play(id, opt.loop || false, volume, panning);
  }

  /**
   * WIP
   * 
   * @private
   */
  // does nothing by default, must be redefined if needed
  setImage(image) {

  }

  /**
   * Draws a box around objects. This method is called when debugging is enabled.
   * 
   * @param {CanvasContext} ctx The context where to draw the box
   */
  showObjectBox(ctx) {
    ctx.strokeStyle = 'rgb(0,230,0)';
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.w + this.x, this.y);
    ctx.lineTo(this.w + this.x, this.y + this.h);
    ctx.lineTo(this.x, this.y + this.h);
    ctx.lineTo(this.x, this.y);
    ctx.closePath();
    ctx.stroke();
  }

  // 1. remove from pool, if pooled object
  // 2. remove from map or scene
  /**
   * Destroy is called when an object is removed from a scene or object
   * 
   * @note calling destroy on a parent will automatically call the destroy method of each child.
   */
  destroy() {
    this._destroyed = true;

    if (typeof this.freeFromPool === 'function') {
      this.freeFromPool();
    }

    if (this.currentMap) {
      this.currentMap.removeObject(this);
    } else if (this.currentScene) {
      this.currentScene.removeObject(this);
    }

    this.children.forEach((child) => {
      child.destroy();
    });
  }
};

export default GfxObject;