import GfxObject from 'Object/Object';
import FX from 'FX/FX';

	/*jshint devel: true, bitwise: false*/
	/*globals Class*/
	/**
	 * The BitmapText class allows to use a spritesheet as a font to draw text onto the screen
	 * 
	 * @param {String} type The type of the sprite.
	 * @param {Object} options The options describing the BitmapText.
	 * @param {String} options.imageSrc The path to the spritesheet file.
	 * @param {Number} [options.offsetX=0] The optional horizontal offset at which to start getting bitmap characters inside the spritesheet.
	 * @param {Number} [options.bmStartY=0] The optinal vertical offset at which to start getting bitmap characters.
	 * @param {Number} charWidth the width of a character in pixels.
	 * @param {Number} charHeight The height of a character in pixels.
	 * 
	 * @note the charset is limited to a subset of ascii right now: a-z 0-9
	 * @example
	 * 
	 *	let myFont = new BitmapText('myFont', {
	 *		offsetX: 34,
	 *		bmStartY: 36,
	 *		charWidth: 16,
	 *		charHeight: 18,
	 *		imageSrc: 'font'
	 *	});
	 */
	class BitmapText extends GfxObject{
        constructor(type, options) {
            super(type, options);

            this.imageSrc = options.imageSrc;

			// TODO: maybe we want to have fullsize ?
			this.w = options.w || 320;
			this.h = options.h || 18;

            this.pixelHeight = 0;

			this.maxLines = Math.floor(this.h / (this.charHeight + this.lineSpacing))

			this.easing = FX.getEasing(options.easing || 'linear');

			this.imageSrc = options.imageSrc || 'image not set';

			// TODO: buffer should be created here and not when object is added to the scene
            this.buffer = null;

			this.image = null;

			this.scrolling = false;

			this.text = options.text || 'BitmapText';

            /*			this.charCodes = this.getCharCodes(this.text);*/

			this.scrollOffsetX = options.scrollOffsetX || 0;
			this.scrollOffsetY = options.scrollOffsetY || 0;

			this.textArray = [];

            this.setFontParams(options);
        }
        
		/**
		 * Generates a new buffer that can hold current text
		 * 
		 * @param {Display} display the display to get the buffer from
		 */
        createBuffer(display) {
			// generate a buffer with enough height to hold every lines of text
			let width = this.w,
				height = this.textArray.length * (this.charHeight + this.lineSpacing);

            this.buffer = display.getBuffer(width, height);
        }
        
		/**
		 * Clears the buffer
		 */
        clearBuffer() {
            this.currentScene.display.clearScreen(this.buffer);
        }
    
		/**
		 * Sets bitmapText properties using options
		 * 
		 * @param {Object} options
		 */
        setFontParams(options) {
            this.lineSpacing = options.lineSpacing || 2;
            this.letterSpacing = options.letterSpacing || 2;

            this.charWidth = options.charWidth || 16;               // 16
            this.charHeight = options.charHeight || 18;     // 18
            this.maxCharPerLine = Math.floor(this.w / (this.charWidth + this.letterSpacing));
            this.maxPixels = this.maxCharPerLine * ((this.charWidth + this.letterSpacing));

            this.offsetX = options.offsetX || 0;     // 34
            this.offsetY = options.offsetY || 0;     // 0
            this.bmStartX = options.bmStartX || 0;  // 0
            this.bmStartY = options.bmStartY || 0;  // 36
        }
        
		/**
		 * Resets the bitmapFont to its default options
		 */
		reset() {
			super.reset();
			this.setTextPosition();
		}
/*		getCharCodes: function(str) {
			var charCodes = [];

			for (var i = 0; i < str.length; ++i) {
				charCodes.push(str.charCodeAt(i));
			}
		},*/
		/**
		 * Returns the lenght of a text line, in characters
		 * 
		 * @param {String} str The string to mesure.
		 * @param {String} eof The character to use as end of line.
		 * 
		 * @returns {Number} The length of the string
		 */
		getNextLineLength(str, eof) {
			let length = 0;


			while(length < str.length && str[length] !== eof) {
				length++;
			}
            
			return length;
		}

		/**
		 * Calculates the position and size of each pixel lines to be rendered onto the screen
		 */
		getLines() {
			let str = this.text,
				line = '',
				end = false,
				i = 0,
				j = 0,
				size = 0;

			// reset textarray
			this.textArray.length = 0;

			while (!end) {
				str = str.replace(/^\n/, '');
				i = this.getNextLineLength(str, '\n');

				if (i) {
					line = str.substr(0, i);
					if (line.length <= this.maxCharPerLine) {
						// start with line length
						str = str.substr(i);
					} else {
						// we need to cut text
						line = str.substr(0, this.maxCharPerLine);
						// start with line length
						str = str.substr(this.maxCharPerLine);
					}

					// add new line
					this.textArray.push({
						text: line,
						x: this.align === 'center' ? Math.floor((this.maxPixels - (line.length * (this.charWidth + this.letterSpacing))) / 2): 0,
						y: j
					});

					j += this.charHeight + this.lineSpacing;
				} else {
					end = true;
				}
			}

            this.pixelHeight = this.textArray.length * (this.charHeight + this.lineSpacing);
		}
        
		/**
		 * Scrolls text from the bottom to the top, firing an optional callback at the end
		 * 
		 * @param {Number} The duration of the scrolling in milliseconds.
		 * @param {Function=undefined} An optional callback to fire when the scrolling is over.
		 */
        scrollFromBottom(duration, callback) {
            // set scrollPos to offscreen
            this.scrollOffsetY = this.h;

            this.scrollText({
                callback: callback,
                duration: duration,
                targetOffsetX: 0,
                targetOffsetY: this.h - this.pixelHeight
            });
        }

		/**
		 * Scrolls text from the top, firing an optional callback at the end
		 * 
		 * @param {Number} The duration of the scrolling in milliseconds.
		 * @param {Function=undefined} An optional callback to fire when the scrolling is over.
		 */
        scrollFromTop(duration, callback) {
            // set scrollPos to offscreen
            this.scrollOffsetY = -this.pixelHeight;

            this.scrollText({
                callback: callback,
                duration: duration,
                targetOffsetX: 0,
                targetOffsetY: 0
            });
        }
        
		/**
		 * Scrolls the current text block
		 * 
		 * @param {Object} options
		 * @param {Number} options.targetOffsetX The horizontal destination of the scrolling.
		 * @param {Number} options.targetOffsetY The vertical destination of the scrolling.
		 * @param {Number} options.duration The duration of the scrolling, in milliseconds.
		 * @param {Function} [options.callback=undefined] An optional callback function to call when the scrolling is done.
		 * 
		 * @note if a scrolling is already in progress, nothing happens
		 * 
		 * @private
		 */
		scrollText(options) {
			if (!this.scrolling) {
                console.log('starting scrolling');
				this.scrolling = true;

				this.callback = options.callback && options.callback.bind(this) || null;
				this.duration = options.duration || 10000;

				this.targetOffsetX = options.targetOffsetX;
				this.targetOffsetY = options.targetOffsetY;

				this.startX = this.scrollOffsetX;
				this.startY = this.scrollOffsetY;

				this.speedX = this.targetOffsetX - this.startX | 0;
				this.speedY = this.targetOffsetY - this.startY | 0;

				this.startMoveTime = new Date().getTime();
			}
		}
        
		/**
		 * Does nothing
		 * 
		 * @private
		 */
		setTextPosition() {
			// set back text position (resets scrolling)
		}
        
		/**
		 * Move() is called at each render loop and calculates the next position during a scrolling
		 */
		move() {
			let currentTime = new Date().getTime(),
				ellapsedTime = currentTime - this.startMoveTime,
				t = ellapsedTime / this.duration,
				moveProgress;

			if (this.scrolling === true) {
				if (ellapsedTime >= this.duration) {
					this.scrolling = false;
					this.scrollOffsetX = this.targetOffsetX;
					this.scrollOffsetY = this.targetOffsetY;
                    if (this.callback) {
                        this.callback();
                    }
				} else {
					moveProgress = this.easing(t, ellapsedTime, 0, 1, this.duration);

					this.scrollOffsetX = this.startX + moveProgress * this.speedX | 0;
					this.scrollOffsetY = this.startY + moveProgress * this.speedY | 0;
				}
			}
		}
        
		/**
		 * Returns the character horizontal offset in pixels inside the spritesheet
		 * 
		 * @param {String} char The character to get the position inside the spritesheet
		 * 
		 * @returns {Number} The horizontal offset in pixels of the character
		 */
		getCharOffset(char) {
			// The magic happens here!
			let code = char.toUpperCase().charCodeAt(0) - 65;

			return code * this.offsetX;
		}
        
		/**
		 * Draws the specified line onto the screen
		 * 
		 * @param {Object} options
		 * @param {Number} options.x The horizontal position of the line to draw
		 * @param {Number} options.x The vertical position of the line to draw
		 * @param {String} options.text The text to draw
		 * 
		 * @example
		 * 
		 * bitmapText.drawLine({
		 * 	x: 0,
		 *  y: 0,
		 *  text: 'hi there'
		 * })
		 */
		drawLine(options) {
			let x = options.x,
				y = options.y,
				i = 0,
                offset = 0,
				max = options.text.length;

			// draw each character
			for (i = 0; i < max; ++i) {
                if (options.text[i].charCodeAt(0) !== 32) {
                    offset = this.getCharOffset(options.text[i]);
				    this.buffer.drawImage(this.image, offset, this.bmStartY, this.charWidth, this.charHeight, x, y, this.charWidth, this.charHeight);
                }
                x += this.letterSpacing + this.charWidth;
			}
		}
        
        /**
		 * Pre-renders text from this.textArray into the internal buffer
		 * 
		 */
        renderText() {
            let i = 0,
                max = 0,
                line;

            max = this.textArray.length;

            for (i = 0; i < max; ++i) {
                line = this.textArray[i];
                this.drawLine(line);
            }
        }
        
		/**
		 * Changes the text of the sprite, calculates every line size, and renders it into
		 * the internal buffer
		 * 
		 * @param {String} text The new text to use
		 */
		setText(text) {
        	this.text = text;

			this.getLines();

			// generate wide-enough internal buffer to hold every lines of text
			if (!this.buffer) {
				this.createBuffer(this.currentScene.display);
			} else {
                this.clearBuffer();
            }

			this.renderText(this.text);
		}
        
		/**
		 * Changes the image to use as spritesheet
		 * 
		 * @param {Image} image The new {image} to use as source.
		 */
		setImage(image) {
			this.image = image;
		}
        
		/**
		 * Sets the scene of the bitmap font
		 * 
		 * @param {Scene} scene The scene to use.
		 */
		setScene(scene) {
			super.setScene(scene);

			this.setText(this.text);
		}
        
		/**
		 * Draws pre-rendered into destination buffer
		 * 
		 * @param {CanvasContext} destCtx The new cancas context where to draw the bitmap font.
		 * @param {Boolean} debug Wether to draw debug stuff.
		 * 
		 * @note: once added onto the scene, this method is automatically called at each render loop.
		 * 
		 * @related {Scene}
		 * 
		 * @private
		 */
        draw(destCtx, debug) {
            var destY,
                copyHeight,
                copyStartY;

			if (!this.visible) {
				return;
			}

            if (this.scrollOffsetY >= 0) {
                destY = this.scrollOffsetY;
                copyHeight = this.h - destY;
                copyStartY = 0;
            } else {
                destY = 0;
                copyHeight = this.h;    // auto clipped ?
                copyStartY = Math.abs(this.scrollOffsetY);
            }
			// if this.scrolling, need to first offset text into this.buffer

            if (this.isFxQueueEmpty()) {
                // draw
				// throw 'TODO: drawing of bitmapText';
				// TODO: should use scrollPos to update destination and simulate horizontal/vertical text scrolling
				destCtx.drawImage(this.buffer.canvas, 0, copyStartY, this.w, copyHeight, this.x + this.scrollOffsetX, this.y + destY, this.w, copyHeight);
				// destCtx.drawImage(this.image, Math.floor(this.x), Math.floor(this.y), Math.floorthis.(w), Math.floor(this.h), Math.floor(drawX + mapOffsetX), Math.floor(drawY + mapOffsetY), Math.floor(scaledW), Math.floor(scaledH));
            } else {
                this.executeFx(destCtx);
				throw 'TODO: drawing of bitmapText';
            }

            if (debug) {
                this.showObjectBox(destCtx);
            }
        }
    };

    export default BitmapText;
