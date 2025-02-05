/***************************************
 * 全局参数设置
 ***************************************/
const CELL_SIZE = 24;         // 每个网格大小
const COLS = 21;              // 列数（建议为奇数）
const ROWS = 21;              // 行数（建议为奇数）
const FPS = 60;               // 游戏帧率
const PACMAN_SPEED = 2;       // 吃豆人移动速度（像素/帧）
const GHOST_SPEED = 1.0;      // 幽灵移动速度（已降低幽灵速度）
const FREEZE_DURATION = 5000; // 冰冻道具效果：幽灵停止追击的持续时间（毫秒）

let canvas, ctx;
let keysPressed = {};
let touchStart = null;
let musicEnabled = true;      // 记录背景音乐是否开启

/***************************************
 * 游戏数据对象
 ***************************************/
let game = {
  maze: [],         // 迷宫二维数组，0:通路，1:墙壁
  beans: [],        // 豆子数组，元素：{col, row, type}，type: 'bean' 或 'power'
  pacman: null,     // 吃豆人对象
  ghosts: [],       // 幽灵数组
  score: 0,
  lives: 3,
  freezeGhostsUntil: 0 // 冰冻幽灵的时间戳
};

/***************************************
 * 角色图片加载（可替换素材）
 ***************************************/
const images = {};
const loadImages = (sources, callback) => {
  let loadedImages = 0;
  let numImages = Object.keys(sources).length;
  for (let src in sources) {
    images[src] = new Image();
    images[src].onload = () => {
      if (++loadedImages >= numImages) {
        callback();
      }
    };
    images[src].src = sources[src];
  }
};

// 图片素材路径，可自定义格式（gif, jpg等）
const imageSources = {
  pacman: 'assets/pacman.png',
  ghost: 'assets/ghost.png',
  bean: 'assets/bean.png',
  power: 'assets/power.png'
};

/***************************************
 * 初始化游戏
 ***************************************/
function initGame() {
  // 初始化 Canvas
  canvas = document.getElementById('gameCanvas');
  ctx = canvas.getContext('2d');
  resizeCanvas();

  // 重置游戏数据
  game.score = 0;
  game.lives = 3;
  game.freezeGhostsUntil = 0;
  
  // 生成随机迷宫，并增加额外分叉路
  game.maze = generateMaze(COLS, ROWS);
  game.maze = modifyMaze(game.maze);
  
  // 在通路上随机摆放豆子和道具
  game.beans = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (game.maze[r][c] === 0) {
        if (Math.random() < 0.6) {
          game.beans.push({col: c, row: r, type: 'bean'});
        } else if (Math.random() < 0.02) {
          game.beans.push({col: c, row: r, type: 'power'});
        }
      }
    }
  }
  
  // 初始化吃豆人，放在左上角的第一个通路位置
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (game.maze[r][c] === 0) {
        game.pacman = {
          x: c * CELL_SIZE + CELL_SIZE/2,
          y: r * CELL_SIZE + CELL_SIZE/2,
          dir: {x: 0, y: 0},
          nextDir: {x: 0, y: 0}
        };
        r = ROWS; c = COLS;
      }
    }
  }
  
  // 初始化幽灵：放在迷宫中央附近
  game.ghosts = [];
  let centerR = Math.floor(ROWS/2);
  let centerC = Math.floor(COLS/2);
  for (let i = 0; i < 3; i++) {
    game.ghosts.push({
      x: (centerC + i) * CELL_SIZE + CELL_SIZE/2,
      y: centerR * CELL_SIZE + CELL_SIZE/2,
      dir: {x: 0, y: 0}
    });
  }
  
  updateUI();
  document.getElementById('restartBtn').style.display = 'none';
}

/***************************************
 * 迷宫生成算法（深度优先搜索生成随机迷宫）
 ***************************************/
function generateMaze(cols, rows) {
  let maze = [];
  for (let r = 0; r < rows; r++) {
    maze[r] = [];
    for (let c = 0; c < cols; c++) {
      maze[r][c] = 1;
    }
  }
  function carve(x, y) {
    const dirs = shuffle([
      {x: 0, y: -2},
      {x: 2, y: 0},
      {x: 0, y: 2},
      {x: -2, y: 0}
    ]);
    for (let d of dirs) {
      let nx = x + d.x, ny = y + d.y;
      if (ny >= 0 && ny < rows && nx >= 0 && nx < cols && maze[ny][nx] === 1) {
        maze[ny - d.y/2][nx - d.x/2] = 0;
        maze[ny][nx] = 0;
        carve(nx, ny);
      }
    }
  }
  let startX = 1, startY = 1;
  maze[startY][startX] = 0;
  carve(startX, startY);
  return maze;
}

// 随机打通部分墙壁，增加更多分叉路
function modifyMaze(maze) {
  for (let r = 1; r < ROWS - 1; r++) {
    for (let c = 1; c < COLS - 1; c++) {
      if (maze[r][c] === 1 && Math.random() < 0.05) {
        if (maze[r-1][c] === 0 || maze[r+1][c] === 0 || maze[r][c-1] === 0 || maze[r][c+1] === 0) {
          maze[r][c] = 0;
        }
      }
    }
  }
  return maze;
}

// 辅助函数：随机打乱数组
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/***************************************
 * 事件处理：键盘和触摸
 ***************************************/
window.addEventListener('keydown', function(e) {
  if (e.key === 'ArrowUp')    game.pacman.nextDir = {x: 0, y: -1};
  if (e.key === 'ArrowDown')  game.pacman.nextDir = {x: 0, y: 1};
  if (e.key === 'ArrowLeft')  game.pacman.nextDir = {x: -1, y: 0};
  if (e.key === 'ArrowRight') game.pacman.nextDir = {x: 1, y: 0};
});

window.addEventListener('touchstart', function(e) {
  if(e.touches.length === 1){
    touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
});
window.addEventListener('touchend', function(e) {
  if (!touchStart) return;
  let touchEnd = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
  let dx = touchEnd.x - touchStart.x;
  let dy = touchEnd.y - touchStart.y;
  if (Math.abs(dx) > Math.abs(dy)) {
    game.pacman.nextDir = {x: dx > 0 ? 1 : -1, y: 0};
  } else {
    game.pacman.nextDir = {x: 0, y: dy > 0 ? 1 : -1};
  }
  touchStart = null;
});

window.addEventListener('resize', resizeCanvas);
function resizeCanvas() {
  if (!canvas) return;
  canvas.width = COLS * CELL_SIZE;
  canvas.height = ROWS * CELL_SIZE;
}

/***************************************
 * 游戏主循环：更新和绘制
 ***************************************/
function gameLoop() {
  if (game.over) return;
  update();
  draw();
  requestAnimationFrame(gameLoop);
}


/***************************************
 * 更新游戏状态
 ***************************************/
function update() {
  // 更新吃豆人：尝试转向
  moveEntity(game.pacman, PACMAN_SPEED, game.pacman.nextDir);
  if (!canMove(game.pacman)) {
    moveEntity(game.pacman, -PACMAN_SPEED, game.pacman.nextDir);
    moveEntity(game.pacman, PACMAN_SPEED, game.pacman.dir);
    if (!canMove(game.pacman)) {
      moveEntity(game.pacman, -PACMAN_SPEED, game.pacman.dir);
    }
  } else {
    game.pacman.dir = game.pacman.nextDir;
  }

  // 检测吃豆人碰到豆子或道具
  checkBeanCollision();

  // 判断是否所有豆子都已吃完，触发胜利结算
  if (game.beans.length === 0) {
    winGame();
    return;
  }

  // 更新幽灵
  for (let ghost of game.ghosts) {
    if (Date.now() < game.freezeGhostsUntil) continue;
    let ghostCell = getCell(ghost.x, ghost.y);
    let pacCell = getCell(game.pacman.x, game.pacman.y);
    let nextDir = bfs(ghostCell, pacCell);
    // 30% 概率随机选择方向，弱化幽灵的追击能力
    if (Math.random() < 0.3) {
      let neighbors = getNeighbors(ghostCell).filter(nb => game.maze[nb.row][nb.col] === 0);
      if (neighbors.length > 0) {
        let randomNeighbor = neighbors[Math.floor(Math.random() * neighbors.length)];
        ghost.dir = { x: randomNeighbor.col - ghostCell.col, y: randomNeighbor.row - ghostCell.row };
      }
    } else if (nextDir) {
      ghost.dir = nextDir;
    }
    moveEntity(ghost, GHOST_SPEED, ghost.dir);
  }

  // 检测幽灵与吃豆人碰撞
  for (let ghost of game.ghosts) {
    if (distance(ghost.x, ghost.y, game.pacman.x, game.pacman.y) < CELL_SIZE/2) {
      if (Date.now() < game.freezeGhostsUntil) continue;
      game.lives--;
      updateUI();
      if (game.lives <= 0) {
        endGame();
        return;
      } else {
        resetPacman();
      }
    }
  }
}


function moveEntity(entity, speed, dir) {
  entity.x += dir.x * speed;
  entity.y += dir.y * speed;
}

function canMove(entity) {
  let cell = getCell(entity.x, entity.y);
  if (cell.col < 0 || cell.col >= COLS || cell.row < 0 || cell.row >= ROWS) return false;
  if (game.maze[cell.row][cell.col] === 1) return false;
  return true;
}

function getCell(x, y) {
  return {
    col: Math.floor(x / CELL_SIZE),
    row: Math.floor(y / CELL_SIZE)
  };
}

function distance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

// 吃豆及道具碰撞检测，同时播放吃豆音效
function checkBeanCollision() {
  let pacCell = getCell(game.pacman.x, game.pacman.y);
  for (let i = game.beans.length - 1; i >= 0; i--) {
    let bean = game.beans[i];
    if (bean.col === pacCell.col && bean.row === pacCell.row) {
      if (bean.type === 'bean') {
        game.score += 10;
      } else if (bean.type === 'power') {
        game.freezeGhostsUntil = Date.now() + FREEZE_DURATION;
        game.score += 50;
      }
      game.beans.splice(i, 1);
      updateUI();
    }
  }
}

function updateUI() {
  document.getElementById('score').textContent = "分数: " + game.score;
  document.getElementById('lives').textContent = "生命: " + game.lives;
}

function resetPacman() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (game.maze[r][c] === 0) {
        game.pacman.x = c * CELL_SIZE + CELL_SIZE/2;
        game.pacman.y = r * CELL_SIZE + CELL_SIZE/2;
        game.pacman.dir = {x: 0, y: 0};
        game.pacman.nextDir = {x: 0, y: 0};
        r = ROWS; c = COLS;
      }
    }
  }
  let centerR = Math.floor(ROWS/2);
  let centerC = Math.floor(COLS/2);
  for (let i = 0; i < game.ghosts.length; i++) {
    game.ghosts[i].x = (centerC + i) * CELL_SIZE + CELL_SIZE/2;
    game.ghosts[i].y = centerR * CELL_SIZE + CELL_SIZE/2;
    game.ghosts[i].dir = {x: 0, y: 0};
  }
}

function endGame() {
  document.getElementById('restartBtn').style.display = 'block';
  cancelAnimationFrame(gameLoop);
}

function winGame() {
  // 显示胜利按钮
  let restartBtn = document.getElementById('restartBtn');
  restartBtn.style.display = 'block';
  restartBtn.textContent = '胜利！再玩一次';
  // 停止游戏循环（此处 cancelAnimationFrame 需要确保游戏循环不再继续调用）
  cancelAnimationFrame(gameLoop);
}


/***************************************
 * 幽灵寻路算法：简单的 BFS（保留，仅供参考）
 ***************************************/
function bfs(start, goal) {
  let queue = [];
  let visited = Array(ROWS).fill(0).map(() => Array(COLS).fill(false));
  let prev = Array(ROWS).fill(0).map(() => Array(COLS).fill(null));
  queue.push(start);
  visited[start.row][start.col] = true;
  while (queue.length > 0) {
    let current = queue.shift();
    if (current.col === goal.col && current.row === goal.row) break;
    let neighbors = getNeighbors(current);
    for (let nb of neighbors) {
      if (!visited[nb.row][nb.col] && game.maze[nb.row][nb.col] === 0) {
        visited[nb.row][nb.col] = true;
        prev[nb.row][nb.col] = current;
        queue.push(nb);
      }
    }
  }
  let path = [];
  let curr = goal;
  while (prev[curr.row] && prev[curr.row][curr.col]) {
    path.push(curr);
    curr = prev[curr.row][curr.col];
  }
  path.reverse();
  if (path.length > 0) {
    let next = path[0];
    let curCell = start;
    let dx = next.col - curCell.col;
    let dy = next.row - curCell.row;
    return { x: dx, y: dy };
  }
  return null;
}

function getNeighbors(cell) {
  let neighbors = [];
  if (cell.row > 0) neighbors.push({col: cell.col, row: cell.row - 1});
  if (cell.row < ROWS - 1) neighbors.push({col: cell.col, row: cell.row + 1});
  if (cell.col > 0) neighbors.push({col: cell.col - 1, row: cell.row});
  if (cell.col < COLS - 1) neighbors.push({col: cell.col + 1, row: cell.row});
  return neighbors;
}

/***************************************
 * 绘制游戏场景
 ***************************************/
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  ctx.fillStyle = "#000080";
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (game.maze[r][c] === 1) {
        ctx.fillRect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }
  }
  
  for (let bean of game.beans) {
    let x = bean.col * CELL_SIZE;
    let y = bean.row * CELL_SIZE;
    if (bean.type === 'bean') {
      ctx.drawImage(images.bean, x + 4, y + 4, CELL_SIZE - 8, CELL_SIZE - 8);
    } else if (bean.type === 'power') {
      ctx.drawImage(images.power, x + 2, y + 2, CELL_SIZE - 4, CELL_SIZE - 4);
    }
  }
  
  ctx.save();
// 将原点移动到吃豆人的中心
ctx.translate(game.pacman.x, game.pacman.y);

// 计算旋转角度，默认图片朝右
let angle = 0;
if (game.pacman.dir.x === 1) {
  angle = 0;           // 向右
} else if (game.pacman.dir.x === -1) {
  angle = Math.PI;     // 向左
} else if (game.pacman.dir.y === 1) {
  angle = Math.PI / 2; // 向下
} else if (game.pacman.dir.y === -1) {
  angle = -Math.PI / 2;// 向上
}

// 旋转画布
ctx.rotate(angle);
// 绘制吃豆人图像（注意原点已在吃豆人中心，所以要调整偏移量）
ctx.drawImage(images.pacman, -CELL_SIZE/2, -CELL_SIZE/2, CELL_SIZE, CELL_SIZE);
ctx.restore();

  
  for (let ghost of game.ghosts) {
    ctx.drawImage(images.ghost, ghost.x - CELL_SIZE/2, ghost.y - CELL_SIZE/2, CELL_SIZE, CELL_SIZE);
  }
}

/***************************************
 * 背景音乐开关处理
 ***************************************/
document.getElementById('musicToggleBtn').addEventListener('click', function() {
  let bgMusic = document.getElementById('bgMusic');
  if (musicEnabled) {
    bgMusic.pause();
    musicEnabled = false;
    this.textContent = "开启背景音乐";
  } else {
    bgMusic.play().catch(()=>{});
    musicEnabled = true;
    this.textContent = "关闭背景音乐";
  }
});

/***************************************
 * 启动游戏
 ***************************************/
window.onload = function() {
  loadImages(imageSources, () => {
    initGame();
    document.getElementById('bgMusic').play().catch(()=>{});
    gameLoop();
  });
};

document.getElementById('restartBtn').addEventListener('click', function() {
  initGame();
});
