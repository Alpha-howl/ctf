import * as utils from "./helpingFuncs.js";


// maze metadata:
export const ROWS = 11;
export const COLS = 11;



// This will get the info about different maze blocks, which is kept in an external JSON file
let MAZE_BLOCKS;

export const GET_MAZE_BLOCKS = async () => {
	if(MAZE_BLOCKS) {return MAZE_BLOCKS;}
	const res = await get("./resources/blocks/blocks-data.json")
	MAZE_BLOCKS = JSON.parse(res);
	return MAZE_BLOCKS;
}
const cachedImgs = {};
let joystick;


class Cell {
	#x;
	#y;
	#index;
	#neighbours = [];
	#visited = false;
	#walls = [true, true, true, true];

	constructor(paramX, paramY, paramIndex) {
		this.#x = paramX;
		this.#y = paramY;
		this.#index = paramIndex;
	}


	getY() {
		return this.#y;
	}
	getX() {
		return this.#x;
	}
	getIndex() {
		return this.#index;
	}
	getNeighbours() {
		return this.#neighbours;
	}
	isVisited() {
		return this.#visited;
	}
	markAsVisited() {
		this.#visited = true;
	}
	getWalls() {
		return this.#walls;
	}
	removeWall(wallIndex) {
		if(wallIndex > 3 || wallIndex < 0) {
			throw "Error - wallIndex out of range (search 4354532)";
			return;
		}
		this.#walls[wallIndex] = false;
	}

	initialiseNeighbours(grid, cols, rows) {
		if(this.#neighbours.length != 0) {
			return;
		}

		if(this.#x > 0) {
			const leftNeighIndex = this.#index-1;
			this.#neighbours.push(grid[leftNeighIndex]);
		}
		if(this.#y > 0) {
			const topNeighIndex = this.#index - cols;
			this.#neighbours.push(grid[topNeighIndex]);
		}
		if(this.#x < cols-1) {
			const rightNeighIndex = this.#index + 1;
			this.#neighbours.push(grid[rightNeighIndex]);
		}
		if(this.#y < rows-1) {
			const bottomNeighIndex = this.#index + cols;
			this.#neighbours.push(grid[bottomNeighIndex]);
		}
	}

	toJSO() {
        return {
            x: this.#x,
            y: this.#y,
            index: this.#index,
            neighbours: [], // cannot compute this as it 
            // would result in a cyclic object loop (client can just re-init neighbours)
            visited: this.#visited,
            walls: this.#walls
        };
    }
}

function calculateCellDimensions(rows, cols) {
	const height = Math.floor(document.body.clientHeight / rows);
	const width = Math.floor(document.body.clientWidth / cols);
	return Math.min(height-1, width-1);
}
async function displayMaze(grid, ctx, cellSize, playerData, cols, rows) {
	let cellIndex = 0;
	let gridLength = grid.length;
	for ( ; cellIndex < gridLength; cellIndex++) {
		const currentCell = grid[cellIndex];
		const walls = currentCell.getWalls();

		let wallIndex = 0;
		for ( ; wallIndex < walls.length; wallIndex++) {
			const currentWall = walls[wallIndex];
			// dblWall means that this wall will be drawn by another cell
			// dblWall true if cur wall is bottom wall & cur cell is not along
			// the bottom row, or if cur wall is right wall & cur cell is not
			// along the right-most col
			const dblWall = wallIndex === 2 && currentCell.getY() != cols-1 ||
							wallIndex === 1 && currentCell.getX() != rows-1;
			if (currentWall === false || dblWall) {
				// if currentWall is false there isn't a wall here
				continue;
			}

			// if still running, wall is true
			// so draw image of wall onto canvas

			// first calculate the starting and ending points
			let wallStartX = currentCell.getX() * cellSize;
			let wallStartY = currentCell.getY() * cellSize;
			
			let wallEndX = wallStartX;
			let wallEndY = wallStartY;
			let wallOrientation;
			if (wallIndex === 0 || wallIndex === 2) {
				wallOrientation = "horizontal";
				// wall is horizontal so make it 
				// 20px in height (for eg):

				if (wallIndex === 2) {
					// if the wall is at the bottom side, add one cellSize to the 
					// vertical coordiantes to shift the wall down
					wallStartY += cellSize;
					wallEndY = wallStartY;
				}
				wallStartY -= 4;
				wallEndY += 4;

				// then make it long horizontally 
				wallEndX += cellSize;
			} else {
				wallOrientation = "vertical";
				// wall is vertical, so make it 
				// 20px in width (for eg):

				if (wallIndex === 1) {
					// if the wall is at the right side, add one cellSize to the 
					// horizontal coordiantes to shift the wall right
					wallStartX += cellSize;
					wallEndX = wallStartX;
				}

				wallStartX -= 4;
				wallEndX += 4;

				// and make it long vertically
				wallEndY += cellSize;
			}

			const scenePosition = {
				x: canvas.width/2 - playerData.x*cellSize,
				y: canvas.height/2 - playerData.y*cellSize
			};
			
			// now draw the image onto the canvas
			const dWidth = wallEndX - wallStartX;
			const dHeight = wallEndY - wallStartY;
			

			const cachedWallIndex = currentCell.getIndex().toString() + wallIndex.toString();

			if(!cachedImgs["wall-"+cachedWallIndex]?.img) {
				cachedImgs["wall-"+cachedWallIndex] = {img: new Image()};
			}
			const currentWallImg = cachedImgs["wall-" + cachedWallIndex].img;
			if(!currentWallImg.src) {
				// set and await load
				const blocks = MAZE_BLOCKS || await GET_MAZE_BLOCKS();
				const walls = blocks[wallOrientation+"Walls"];
				const randWallName = walls[Math.floor(Math.random()*walls.length)];
				const randSrc = "../game" + blocks[randWallName].src;
				cachedImgs["wall-"+cachedWallIndex].data = blocks[randWallName];
				cachedImgs["wall-"+cachedWallIndex].img.src = randSrc;
				await (() => {
					return new Promise(loaded => {
						cachedImgs["wall-"+cachedWallIndex].img.addEventListener("load", loaded);
					});
				})();
			}
			const curImg = cachedImgs["wall-"+cachedWallIndex];
			// drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)
			ctx.drawImage(
				curImg.img, 				// image element
				curImg.data.sheetStartX, 	// starting x on the source
				curImg.data.sheetStartY, 	// starting y on the source
				curImg.data.width, 			// width of the source
				curImg.data.height, 		// height of the source
				wallStartX+scenePosition.x, // destination x on the canvas
				wallStartY+scenePosition.y, // destination y on the canvas
				dWidth, 					// width on the canvas
				dHeight						// height on the canvas
			);
		}
	}
}
// preload the sprites
const wallImageElmnt = new Image();
wallImageElmnt.src = "../game/resources/blocks/rocks/rock1.png";


const VISION_RADIUS = 3;

const displayedCols = 2*VISION_RADIUS+1;
const cellSize = calculateCellDimensions(displayedCols, displayedCols);

const canvas = document.getElementById("canvas1");
const ctx = canvas.getContext("2d");
canvas.width = displayedCols*cellSize;
canvas.height = displayedCols*cellSize;




const amplifier = 0.16;
let Grid;
let lastAnimated = 0;
const animateInterval = 80;
async function animate() {
	// validate pressedArrow keys
	const playerX = Math.floor(playerData.x / cellSize);
	const playerY = Math.floor(playerData.y / cellSize);
	pubnub.publish({
        channel: channelName,
        message: {
			action: "validate-frame",
			pressedArrowKeys,
			playerX,
			playerY,
			timeStamp: ~~performance.now()
		}
    });
	// the return message of this will contain smallGrid and playerData. Use those to draw the new scene.
	setTimeout(() => {
		requestAnimationFrame(animate);
	}, animateInterval);
}

let lastLoop = performance.now();
function animateClient() {
	const thisLoop = performance.now();
    const clientInterval = thisLoop - lastLoop;
    lastLoop = thisLoop;
    const amplifierClient = amplifier*(clientInterval/animateInterval);

	const playerDataRel = [playerData.x/cellSize, playerData.y/cellSize];
	const playerHitbox = hitboxData.player;
	const closeWalls = getWallsPlayerWillCollideWith(playerDataRel, Grid, amplifierClient, COLS, playerHitbox);
	const now = performance.now();
	if(!closeWalls[3] && pressedArrowKeys.left < now) {
		playerData.x -= amplifierClient*cellSize;
	}
	if(!closeWalls[1] && pressedArrowKeys.right < now) {
		playerData.x += amplifierClient*cellSize;
	}
	if(!closeWalls[0] && pressedArrowKeys.up < now) {
		playerData.y -= amplifierClient*cellSize;
	}
	if(!closeWalls[2] && pressedArrowKeys.down < now) {
		playerData.y += amplifierClient*cellSize;
	}

	const scenePosition = {
		x: canvas.width/2 - playerData.x,
		y: canvas.height/2 - playerData.y
	};
	
	const visibleGrid = findRadiusAroundPlayer(Grid, playerDataRel[0], playerDataRel[1], COLS, VISION_RADIUS);
	ctx.clearRect(0,0,canvas.width, canvas.height);
	displayMaze(visibleGrid, ctx, cellSize, {x:playerDataRel[0],y:playerDataRel[1]}, ROWS, COLS);

	nearbyItems.forEach(item => {
		const {position, isDead, name, team, hitboxData} = item;
		ctx.fillStyle = (name === "flag" && team === "teamA") ? "#89a481" : // if it's a teamA flag
						(name === "flag" && team === "teamB") ? "#a97e7e" : // if it's a teamB flag
						isDead? "#ffffff" : // if it's a dead player
						team === "teamA" ? "#597451" : "#794e4e"; // if it's a player (teamA or teamBV)
		const startX = (position[0]+.5-hitboxData.width/2)*cellSize + scenePosition.x;
		const startY = (position[1]+.5-hitboxData.height/2)*cellSize + scenePosition.y;
		ctx.fillRect(startX, startY, hitboxData.width*cellSize, hitboxData.height*cellSize);
	});

	ctx.fillStyle = userTeamInfo[0] === "teamA" ? "#597451" : "#794e4e";
	const userSpriteStartX = (canvas.width-playerHitbox.width*cellSize)/2;
	const userSpriteStartY = (canvas.height-playerHitbox.height*cellSize)/2;
	const userSpriteWidth = playerHitbox.width*cellSize;
	const userSpriteHeight = playerHitbox.height*cellSize;
	ctx.fillRect(userSpriteStartX, userSpriteStartY, userSpriteWidth, userSpriteHeight);

	requestAnimationFrame(animateClient);
}
let nearbyItems = [];
const playerData = {
	x: .5*cellSize,
	y: .5*cellSize
}


function getWallsPlayerWillCollideWith(coords, grid, amplifier, cols, hitboxData) {
    const position = {
        x: coords[0],
        y: coords[1]
    };

    const row = Math.floor(position.y);
    const col = Math.floor(position.x);

    const positionInCell = {
        x: position.x-col,
        y: position.y-row
    };




    const cellObject = grid[getIndexFromXY(col, row, cols)];
    if(!cellObject) {return [false, false, false, false];}
    const currentCellWalls = cellObject.getWalls();

    let wallsThePlayerIsCloseTo = Array(4).fill(false); // in format [top, right, bottom, left]
    const sidesThePlayerIsCloseTo = [];

    // if-else clause for left&right
    if(positionInCell.x - hitboxData.width/2 - amplifier < 0) {
        // player is close to left edge of the cell
        // => check if there is a wall there
        sidesThePlayerIsCloseTo.push(3);
        wallsThePlayerIsCloseTo[3] = currentCellWalls[3];
    }
    else if(positionInCell.x + hitboxData.width/2 + amplifier > 1) {
        // player is close to right edge of the cell
        // => check if there is a wall there
        sidesThePlayerIsCloseTo.push(1);
        wallsThePlayerIsCloseTo[1] = currentCellWalls[1];
    }
    
    // separate if-else clause for top&bottom
    if(positionInCell.y - hitboxData.height/2 - amplifier < 0) {
        // player is close to top edge of cell
        // => check if there is a wall there
        sidesThePlayerIsCloseTo.push(0);
        wallsThePlayerIsCloseTo[0] = currentCellWalls[0];
    }
    else if(positionInCell.y + hitboxData.height/2 + amplifier > 1) {
        // player is close to bottom edge of cell
        // => check if there is a wall there
        sidesThePlayerIsCloseTo.push(2);
        wallsThePlayerIsCloseTo[2] = currentCellWalls[2];
    }

    const playerNotByWalls = ! wallsThePlayerIsCloseTo.some(wall => {
        return wall === true;
    });
    if(playerNotByWalls && sidesThePlayerIsCloseTo.length === 2 /*===2*/) {
        // player's cell has no walls, now look at destination cell
        // the destination will always be diagonal otherwise the player's
        // cell would have had walls at the place the destination has walls
        
        // sidesThePlayerIsCloseTo will have at most 2 elmnts
        // use .some(..) to check if any of the sides the player is close to 
        // has a wall diagonally from it
        const playerCannotMoveThere = sidesThePlayerIsCloseTo.some((side, sideIndex) => {
            // invert side to correspond to destination wall index
            const wallIndexToCheckOfDestination = 3-side;

            const movementX = side === 3 ? -1 : side === 1 ? 1 : 0;
            const movementY = side === 0 ? -1 : side === 2 ? 1 : 0;
            const destinationIndex = getIndexFromXY(col+movementX,row+movementY,cols);
            const destinationCell = grid[destinationIndex];

            if(destinationIndex < 0) {
                // destionation is outside grid, do not allow this.
                return true;
            }

            // now return true if a wall is blocking the path:
            return destinationCell.getWalls()[wallIndexToCheckOfDestination] === true;
        });
        // todo - explain this ^ with a diagram

        if(playerCannotMoveThere) {
            // if the player is trying to move diagonally into a cell that has walls
            // at the corner the player is trying to enter it from, then
            // act as if the current cell has one of those walls which will cause
            // the player to slide down or across the outside of 
            // the destination cell instead of entering it.
            wallsThePlayerIsCloseTo[sidesThePlayerIsCloseTo[0]] = true;
        }
    }

    return wallsThePlayerIsCloseTo;
}


function updateLoadingBar(progress) {
	const percentage = ~~(progress*100);
	
	document.getElementById("progress-hint").innerHTML = percentage + "%";
	document.getElementById("progress-bar").style.width = percentage + "%"


	if (progress === 1) {
		const progressContainer = document.getElementById("progress-container");

		const keyFrames = [{
			opacity: 0
		}];
		const animation = progressContainer.animate(keyFrames, {
			duration: 450,
			delay: 500
		});
		animation.addEventListener("finish", () => {
			progressContainer.style.display = "none";
		});
	}
}

function loadAssets() {
	utils.waitUntil(() => {
		return document.body.loaded;
	}).then(showMainMenu);


	let assetsLoaded = 0;

	const functionsWhichLoadAssets = [utils.loadStyles, utils.loadJs, GET_MAZE_BLOCKS, checkUserLoggedIn];
	const totalAssets = functionsWhichLoadAssets.length;
	for(let i = 0; i < totalAssets; i++) {
		const assetLoadingFunc = functionsWhichLoadAssets[i];
		assetLoadingFunc().then(res => {
			assetsLoaded += 1;
			updateLoadingBar(assetsLoaded/totalAssets);
		});
	}
}


async function checkUserLoggedIn() {
	await utils.waitUntil(() => {
		return window.$?.ajax != undefined;
	});
	// send req validate-jwt
	const {success} = await $.ajax("https://shy-plum-bass-slip.cyclic.app/validate-jwt", {
		method: "POST",
		cache: false,
		data: {
			jwt: localStorage.getItem("jwt")
		}
	});

	if(success) {
		// the user is signed in, return from the func
		return true;
	}

	// if not signed in notify user ab this
	document.getElementById("sign-in-msg").classList.remove("hidden");
	return false;
}



let mainMenu;
window.addEventListener("load", () => {
	document.body.loaded = true;
	mainMenu = document.getElementById("main-menu");

	document.getElementById("account-btn").addEventListener("click", accountButtonClick);
	document.getElementById("join-room-btn").addEventListener("click", playOnlineButtonClick);
	document.getElementById("help-btn").addEventListener("click", helpButtonClick);
});
loadAssets();



function showMainMenu() {
	mainMenu.classList.remove("hidden");
}






async function displaySearchingForGameScreen() {
	const htmlCode = await get("./resources/screens/searching-for-game-screen.html");
	const loadingDiv = document.createElement("div");
	loadingDiv.id = "searching-for-game-screen";
	loadingDiv.innerHTML = htmlCode;
	document.body.appendChild(loadingDiv);
}


async function displayTeamsScreen(teamsInfo) {
	// request the HTML code first
	const htmlCode = await get("./resources/screens/teams-screen.html");
	const teamsScreenContainer = document.createElement("div");
	teamsScreenContainer.id = "teams-screen-container";
	teamsScreenContainer.innerHTML = htmlCode;
	document.body.appendChild(teamsScreenContainer);

	document.getElementById("searching-for-game-screen")?.classList?.add("hidden");

	// then place the usenames of team A into the container elmnt of team A:
	const teamAElmnt = document.getElementById("team-a-container");
	teamsInfo.teamA.players.forEach(username => {
		const newPlayerBox = document.createElement("div");
		newPlayerBox.classList.add("player-box");
		newPlayerBox.innerHTML = `<span>${username}</span>`;
		teamAElmnt.appendChild(newPlayerBox);
	});

	// do the same for the usernames of the players who will be playing for 
	// team B:
	const teamBElmnt = document.getElementById("team-b-container");
	teamsInfo.teamB.players.forEach(username => {
		const newPlayerBox = document.createElement("div");
		newPlayerBox.classList.add("player-box");
		newPlayerBox.innerHTML = `<span>${username}</span>`;
		teamBElmnt.appendChild(newPlayerBox);
	});
}

async function playOnlineButtonClick() {
	displaySearchingForGameScreen();
	document.getElementById("main-menu").classList.add("hidden");
	joinNextAvailableRoom();
}
function accountButtonClick() {
	location.assign("manage-account");
}
async function helpButtonClick() {
	const alreadyClicked = document.getElementById("help-box");
	if(alreadyClicked) {
		return;
	}
	const htmlSrc = "./resources/screens/help.html";
	const htmlCode = await get(htmlSrc);

	const container = document.createElement("div");
	container.id = "help-container";
	container.innerHTML = htmlCode;

	document.body.appendChild(container);

	const closeBtn = container.querySelector("#close-btn");
	closeBtn.addEventListener("click", () => {
		const animation = container.animate([
			{opacity: 0}
		], {duration: 190});

		animation.addEventListener("finish", () => {
			document.body.removeChild(container);
		});
	});
}


function convertJsoCellToClassCell(jsoCell) {
	const cellClassObk = new Cell(jsoCell.x, jsoCell.y, jsoCell.index);
    if(jsoCell.visited) {
    	cellClassObk.markAsVisited();
    }
    jsoCell.walls.forEach((wall, index) => {
    	if(wall === false) {
    		cellClassObk.removeWall(index);
    	}
    });

    return cellClassObk;
}



let pubnub;
let channelName;
let userTeamInfo;
async function joinNextAvailableRoom() {
	const joinRoomResponse = await $.ajax("https://shy-plum-bass-slip.cyclic.app/join-room", {
		method: "POST",
		data: {
			jwt: localStorage.getItem("jwt")
		}
	});
	if(joinRoomResponse.message === "must-be-logged-in") {
		// error: user is not signed in. They must sign in first.
		document.getElementById("sign-in-msg").classList.remove("hidden");
		return;
	}

	// user is signed in and has joined a room
	// display the maze	

	console.log(joinRoomResponse);

	const jsoMaze = joinRoomResponse.mazeData;
	Grid = jsoMaze.map(convertJsoCellToClassCell);

	const canvas = document.getElementById("canvas1");
	canvas.classList.remove("hidden");
	const cellSize = calculateCellDimensions(ROWS, COLS);
	displayMaze(Grid, canvas.getContext("2d"), cellSize, {x:COLS/2,y:ROWS/2}, COLS, ROWS);



	const roomId = joinRoomResponse.roomId;
	console.log("Ready to play req sent, room id:", roomId);



	{
		utils.waitUntil(() => {
			return document.getElementById("lobby-msg") != null;
		}).then(() => {
			displayOptionalLobbyPrompt();
			addArrowKeysEventListeners();
		});
	}

	
	
	const sendReq = async () => {
		return await $.ajax("https://shy-plum-bass-slip.cyclic.app/ready-to-play", {
			method: "POST",
			data: {
				jwt: localStorage.getItem("jwt"),
				roomId
			}
		});
	};
	let readyToPlayResponse = await sendReq();
	while (readyToPlayResponse.message === "waiting-for-players") {
		await (() => {
			return new Promise(resolve => {
				setTimeout(resolve, 10000);
			});
		})();
		console.log("Waiting for more players. readyToPlayResponse:",readyToPlayResponse);
		readyToPlayResponse = await sendReq();
	}

	if(readyToPlayResponse.message != "start-game") {
		console.log("Problem detected:",readyToPlayResponse);
		return;
	}

	channelName = readyToPlayResponse.pubnubChannelName;
	const publicChannelName = readyToPlayResponse.pubnubChannelName.match(/ctf-room-\d+/)[0];
	pubnub = new PubNub({
	    publishKey : "pub-c-8874688e-5c73-4365-b1a5-9a24fd51926d",
	    subscribeKey : "sub-c-e7d0b79a-a683-4936-9612-f108175de23a",
	    uuid: "sec-c-YTQwMzU4NzktYzc4Zi00YThjLWI5NzUtNzE5MjVlYmFiMGZl"
	});
	pubnub.subscribe({channels: [channelName, publicChannelName]});
    pubnub.addListener({
        message: function(receivedMessage) {
            requestAnimationFrame(() => {
            	handleClientPubNubReceivedMessage(receivedMessage);
            });
        }
    });
	

	openPubnub(channelName);

	await (() => {
		return new Promise(done => {
			setTimeout(done, 4000);
		});
	})();


	// if the code is still running at this point, the response contains:
	// teamsInfo, pubnubChannelName
	displayTeamsScreen(readyToPlayResponse.teamsInfo);
	drawSprites(readyToPlayResponse.teamsInfo);
	getDieMsgScreen();
	userTeamInfo = readyToPlayResponse.teamsInfo.teamA.players.includes(readyToPlayResponse.username) ? 
                ["teamA", readyToPlayResponse.teamsInfo.teamA] : ["teamB", readyToPlayResponse.teamsInfo.teamB];
    if(joystick) {
    	joystick.options.color = userTeamInfo[0] === "teamA" ? "#597451" : "#794e4e";
    	document.body.requestFullscreen();
    }

	
    setTimeout(async () => {
    	console.log("published ready-to-play");
    	await pubnub.publish({
	        channel: channelName,
	        message: {
	            action: "ready-to-play",
	            jwt: localStorage.getItem("jwt"),
	            roomId,
	        }
	    });
    }, 2000);

    window.pubnub = pubnub;
}

let shouldNotOpenPubnub = false;
async function openPubnub(channelName) {
	if(shouldNotOpenPubnub) {
		return;
	}
	$.ajax("https://shy-plum-bass-slip.cyclic.app/pubnub-open", {
		method: "POST",
		data: {
			channelName
		}
	}).always(() => {
		console.log("opening pubnub again");
		openPubnub(channelName);
	});
}

function drawSprites(teamsInfo) {
	playerData.x = (teamsInfo.teamA.spawnPoint[0] + .5)*cellSize;
	playerData.y = (teamsInfo.teamA.spawnPoint[1] + .5)*cellSize;
}


function findRadiusAroundPlayer(grid, playerX, playerY, cols, radius) {
	const sqrRadius = radius*radius;
	const gridToBeDisplayed = [];
	for(let i = 0; i < grid.length; i++) {
		const currentCell = grid[i];
		//const playerCell = grid[getIndexFromXY(playerX, playerY, cols)];

		const cellX = currentCell.getX();
		const cellY = currentCell.getY();
		const pythagSquareDistanceFromPlayer = (playerX - cellX)**2 + (playerY - cellY)**2;

		if(pythagSquareDistanceFromPlayer > sqrRadius+2) {
			continue;
		}

		gridToBeDisplayed.push(currentCell);

	}

	return gridToBeDisplayed;
}





const pressedArrowKeys = {
	left: Infinity,
	right: Infinity,
	up: Infinity,
	down: Infinity
};


function getIndexFromXY(x, y, cols) {
	return y*cols + x;
}





function displayOptionalLobbyPrompt() {
	const msg = document.getElementById("lobby-msg");
	msg.classList.remove("hidden");
	document.getElementById("scout-area-btn").addEventListener("click", () => {
		const loadingScreen = document.getElementById("searching-for-game-screen");
		const loadingContainer = document.getElementById("loading-container");

		// stop the spinner and animate out the loading screen
		Array.from(loadingScreen.querySelectorAll(".loader-container")).forEach(child => {
			child.style.animation = "none";
		});

		const timing = {
			duration: 375,
			iterations: 1,
			timingFunciton: "cubic-bezier(.17,.67,.04,1.37)"
		};
		const keyFrames = [
			{transform: "scale(1)", opacity: 1},
			{transform: "scale(.90)", opacity: .9},
			{transform: "scale(.90)", opacity: 0},
		];

		loadingContainer.animate(keyFrames, timing);
		setTimeout(() => {
			document.body.removeChild(loadingScreen);
		}, timing.duration);
		//addArrowKeysEventListeners();
		//animateClient();
	});
}


function removeTeamsScreen() {
	document.getElementById("teams-screen-container").classList.add("hidden");
}

let lastLogged = 0, lastTimeStamp = 0;
function handleClientPubNubReceivedMessage(receivedMessage) {
	const action = receivedMessage.message.action;
	//console.log(receivedMessage.message);
	switch(action) {
		case "start-in-3s": {
			teamAScoresElmnt = document.createElement("div");
			teamBScoresElmnt = document.createElement("div");
			teamAScoresElmnt.innerText = "0";
			teamBScoresElmnt.innerText = "0";
			teamAScoresElmnt.style.color = "#794e4e";
			teamBScoresElmnt.style.color = "#597451";
			const scoresParentElmnt = document.createElement("div");
			scoresParentElmnt.id = "scores-container";
			scoresParentElmnt.appendChild(teamAScoresElmnt);
			scoresParentElmnt.appendChild(teamBScoresElmnt);
			document.body.appendChild(scoresParentElmnt);

			removeTeamsScreen();
			const timeLeft = receivedMessage.message.startAt - Date.now();
            displayCountdown(timeLeft/1000);
            setTimeout(animate, timeLeft+10);
            setTimeout(animateClient, timeLeft+10);
			break;
		}

		case "frame-results": {
			if(lastTimeStamp > receivedMessage.message.timeStamp) {
				break;
			}
			// here, draw the new frame calcualted by the server

			if(receivedMessage.message.ended) {
				const scores = receivedMessage.message.scores;
				teamAScoresElmnt.innerText = scores.teamA;
				teamBScoresElmnt.innerText = scores.teamB;

				if(scores.teamA >= 5 || scores.teamB >= 5) {
					const winningTeam = scores.teamA >= 5 ? "teamA" : "teamB";
					shouldNotOpenPubnub = true;
					animate = () => {
						console.log("Stopped animating");
					};
					console.log(winningTeam, scores, winningTeam === userTeamInfo[0], userTeamInfo);
					displayWinningTeam(winningTeam);
				}
				break;
			}

			nearbyItems = receivedMessage.message.nearbyItems;

			const nativePlayerDataRel = {
				x: playerData.x/cellSize,
				y: playerData.y/cellSize
			};
			const playerDataMsg = {
				x: receivedMessage.message.playerData.position[0] + .5,
				y: receivedMessage.message.playerData.position[1] + .5
			};

			const playerFarAway = Math.abs(playerDataMsg.x - nativePlayerDataRel.x) > 1 || 
								  Math.abs(playerDataMsg.y - nativePlayerDataRel.y) > 1;
			if(playerFarAway) {
				playerData.x = playerDataMsg.x*cellSize;
				playerData.y =  playerDataMsg.y*cellSize;
			}

			

			const scores = receivedMessage.message.scores;
			teamAScoresElmnt.innerText = scores.teamA;
			teamBScoresElmnt.innerText = scores.teamB;

			if(performance.now() - logged > 3000) {
				logged = performance.now();
				console.log(Math.abs(playerDataMsg.x - nativePlayerDataRel.x));
			}

			break;
		}
	}
}
let logged = 0;

const hitboxData = {
	player: {width: .22, height: .22},
	flag: {width: 1, height: 1}
}

let calledEndMatch = false;
async function displayWinningTeam(winningTeam) {
	if(calledEndMatch) {
		return;
	}
	calledEndMatch = true;
	const userWon = userTeamInfo[0] === winningTeam;
	const fileName = userWon ? "victory" : "defeat";
	const htmlSrc = "./resources/screens/" + fileName + ".html";
	const htmlCode = await get(htmlSrc);
	const container = document.createElement("div");
	container.innerHTML = htmlCode;
	container.id = "match-end-msg";
	document.body.appendChild(container);

	document.getElementById("return-to-menu").addEventListener("click", () => {
		document.getElementById("main-menu").classList.remove("hidden");
		document.getElementById("canvas1").classList.add("hidden");
		Grid = [];
		Object.keys(cachedImgs).forEach(key => {
			delete cachedImgs[key];
		});
		window.onkeydown = () => {};
		window.onkeyup = () => {};
		const scoresParentElmnt = document.getElementById("scores-container");
		document.body.removeChild(scoresParentElmnt);
		document.body.removeChild(container);
	});
}

const fakeLatency = 250;
function keyIsPressed(e) {
	const keycode = e.keyCode;
	//setTimeout(() => {
	const reflectChangeFrom = performance.now()+fakeLatency;
	switch(keycode) {
		case 37:
			pressedArrowKeys.left = pressedArrowKeys.left === Infinity ? reflectChangeFrom : pressedArrowKeys.left;
			break;
		case 39:
			pressedArrowKeys.right = pressedArrowKeys.right === Infinity ? reflectChangeFrom : pressedArrowKeys.right;
			break;
		case 38:
			pressedArrowKeys.up = pressedArrowKeys.up === Infinity ? reflectChangeFrom : pressedArrowKeys.up;
			break;
		case 40:
			pressedArrowKeys.down = pressedArrowKeys.down === Infinity ? reflectChangeFrom : pressedArrowKeys.down;
			break;
	}
	//}, fakeLatency);
}
function keyIsReleased(e) {
	const keycode = e.keyCode;
	//setTimeout(() => {
	switch(keycode) {
		case 37:
			pressedArrowKeys.left = Infinity;
			break;
		case 39:
			pressedArrowKeys.right = Infinity;
			break;
		case 38:
			pressedArrowKeys.up = Infinity;
			break;
		case 40:
			pressedArrowKeys.down = Infinity;
			break;
	}
	//}, fakeLatency);
}

function addArrowKeysEventListeners() {
	window.addEventListener("keydown", keyIsPressed);
	window.addEventListener("keyup", keyIsReleased);

	function isTouchEnabled() {
	    return ( "ontouchstart" in window ) ||
	           ( navigator.maxTouchPoints > 0 ) ||
	           ( navigator.msMaxTouchPoints > 0 );
	}
	if(isTouchEnabled()) {
		joystick = nipplejs.create({
			mode: "semi",
		    size: 100,
		    color: "white",
		    dynamicPage: true,
		    restOpacity: .3,
		    catchDistance: 100
		});
		joystick.on("move", (_, data) => {
			Object.keys(pressedArrowKeys).forEach(key => {
				pressedArrowKeys[key] = Infinity;
			});

			const reflectChangeFrom = performance.now()+fakeLatency;

			const angle = data.angle.degree;

			if(angle < 245 && angle > 115 && pressedArrowKeys.left === Infinity) {
				pressedArrowKeys.left = reflectChangeFrom
			}
			else if((angle < 65 || angle > 295) && pressedArrowKeys.right === Infinity) {
				pressedArrowKeys.right = reflectChangeFrom;
			}

			if(angle < 155 && angle > 25 && pressedArrowKeys.up === Infinity) {
				pressedArrowKeys.up = reflectChangeFrom;
			}
			else if(angle < 335 && angle > 205 && pressedArrowKeys.down === Infinity) {
				pressedArrowKeys.down = reflectChangeFrom;
			}
		});
		joystick.on("end", () => {
			Object.keys(pressedArrowKeys).forEach(key => {
				pressedArrowKeys[key] = Infinity;
			});
		});
	}
}



async function displayCountdown(secs) {
	secs = ~~secs;
	const countdownElmnt = document.getElementById("countdown");
	countdownElmnt.classList.remove("hidden");
	const sleep = (() => {
	  return new Promise(done => {
	    setTimeout(done, 950);
	  });
   	});
	while (secs > 0) {
		secs--;
		// output current no. of secs left
		countdownElmnt.innerText = secs;
		// sleep 1 second
		await sleep();
	}
	countdownElmnt.classList.add("hidden");
}



function getDieMsgScreen() {
	get("./resources/screens/die-msg.html").then(htmlCode => {
		const wrapper = document.createElement("div");
		wrapper.id = "die-msg-container";
		wrapper.classList.add("hidden");
		wrapper.innerHTML = htmlCode;
		document.body.appendChild(wrapper);
		dieMsg = wrapper;
	});
}



const username = localStorage.getItem("cached-username");
let dieMsg, teamAScoresElmnt, teamBScoresElmnt;




// https://rapidapi.com/collection/list-of-free-apis