const FIRST_MESSAGE_OBJECTIVE = Object.freeze({
  "objective": "Use print() to display a message.",
  "example": "print(\"This is my game!\");",
  "help": "print() lets your program show a message. Put text inside quotation marks, inside the parentheses.",
  "helpExample": "print(\"Hello!\");\nprint(\"I made my first game!\");",
  "validation": "print"
});

/** Session-only beginner challenges. */
export const CHALLENGES = Object.freeze([
  Object.freeze({
  "id": 1,
  "title": "Challenge 1 \u2014 Your First Message",
  ...FIRST_MESSAGE_OBJECTIVE
}),
  Object.freeze({
  "id": 2,
  "title": "Challenge 2 \u2014 Meet the Console",
  "objective": "Use console.log() to write a message to the Console.",
  "example": "console.log(\"This is the console\");",
  "help": "console.log() sends information to the Console. These messages help you see what your program is doing.",
  "helpExample": "console.log(\"Hello Console!\");\nconsole.log(\"My game is running!\");",
  "validation": "console.log"
}),
  Object.freeze({
  "id": 3,
  "title": "Challenge 3 \u2014 Leave a Comment",
  "objective": "Write a JavaScript comment using //.",
  "example": "// This is a comment",
  "help": "A comment is a note for people reading your code. JavaScript ignores everything after // on that line. Use notes to explain what your code does.",
  "helpExample": "// Make the player jump higher\n// This is a note for myself",
  "validation": "comment"
}),
  Object.freeze({
  "id": 4,
  "title": "Challenge 4 \u2014 Your First Number",
  "objective": "Create a variable containing a number, then display it with print().",
  "example": "let number = 9;\nprint(number);",
  "help": "A variable is like a named box that remembers a value. Here, number remembers 9. The second line displays the value stored in that box.",
  "helpExample": "let score = 10;\nprint(score);",
  "validation": "number"
}),
  Object.freeze({
  "id": 5,
  "title": "Challenge 5 \u2014 Your First Text Variable",
  "objective": "Store text in a variable, then display it with print().",
  "example": "let name = \"Ace\";\nprint(name);",
  "help": "Variables can remember text too! Put text inside quotation marks. Then use the variable name instead of writing the text again.",
  "helpExample": "let hero = \"Super Coder\";\nprint(hero);",
  "validation": "string"
}),
  Object.freeze({
  "id": 6,
  "title": "Challenge 6 \u2014 Create a Cube",
  "objective": "Create a cube in the game world.",
  "example": "createCube();",
  "help": "createCube() asks the game to create a cube. The parentheses call the function. You do not need any options yet.",
  "helpExample": "createCube();",
  "validation": "createCube"
}),
  Object.freeze({
  "id": 7,
  "title": "Challenge 7 \u2014 Create a Sphere",
  "objective": "Create a sphere in the game world.",
  "example": "createSphere();",
  "help": "createSphere() creates a round 3D object. It works like createCube(), but makes a different shape.",
  "helpExample": "createSphere();",
  "validation": "createSphere"
}),
  Object.freeze({
  "id": 8,
  "title": "Challenge 8 \u2014 Create a Cone",
  "objective": "Create a cone in the game world.",
  "example": "createCone();",
  "help": "createCone() creates a cone-shaped 3D object. Calling different functions tells the game to do different things.",
  "helpExample": "createCone();",
  "validation": "createCone"
}),
  Object.freeze({
  "id": 9,
  "title": "Challenge 9 \u2014 Create a Cylinder",
  "objective": "Create a cylinder in the game world.",
  "example": "createCylinder();",
  "help": "createCylinder() creates a cylinder-shaped 3D object. These shape functions all follow the same pattern: a name followed by parentheses.",
  "helpExample": "createCylinder();",
  "validation": "createCylinder"
}),
  Object.freeze({
  "id": 10,
  "title": "Challenge 10 \u2014 Meet the Player",
  "objective": "Get the player object and save it in a variable.",
  "example": "const player = getPlayer();",
  "help": "getPlayer() gives your code access to the player in the game. const player = saves it in a variable for later. const means this variable is not meant to be assigned something else.",
  "helpExample": "const player = getPlayer();",
  "validation": "getPlayer"
}),
  Object.freeze({
  "id": 11,
  "title": "Challenge 11 \u2014 Jump Higher",
  "objective": "Get the player and change the player's jump force.",
  "example": "const player = getPlayer();\nplayer.setJumpForce(20);",
  "help": "The first line gets the player. The second calls one of the player's functions. setJumpForce(20) changes how strongly the player jumps. A larger force generally makes a higher jump.",
  "helpExample": "const player = getPlayer();\nplayer.setJumpForce(20);",
  "validation": "setJumpForce"
}),
  Object.freeze({
  "id": 12,
  "title": "Challenge 12 \u2014 Are You High Enough?",
  "objective": "Your code can make decisions!\n\nThe height is currently 10.\n\nUse an if statement to check whether the height is greater than 5.\n\nIf it is, display:\n\nYou are high enough!",
  "example": "let height = 10;\n\nif (height > 5) {\n  print(\"You are high enough!\");\n}",
  "help": "let height = 10; creates a variable holding the number 10. if checks whether something is true. > means greater than. { } surrounds the instructions to execute when the condition is true. print() displays the message. If height were 3, the message would not appear because 3 is not greater than 5. After completing the challenge, try changing height to 3 and run your code again.",
  "helpExample": "let height = 10;\n\nif (height > 5) {\n  print(\"You are high enough!\");\n}",
  "validation": "heightIf"
}),
  Object.freeze({
  "id": 13,
  "title": "Challenge 13 \u2014 Make a Choice!",
  "objective": "It's cold in Snow Maze!\n\nThe temp is -5.\n\nWrite an if / else statement that checks temp.\n\nIf temp is below 0, display:\n\nWear a coat!\n\nOtherwise, display:\n\nNo coat needed!",
  "example": "let temp = -5;\n\nif (temp < 0) {\n  print(\"Wear a coat!\");\n} else {\n  print(\"No coat needed!\");\n}",
  "help": "let temp = -5; stores the current value. < means less than. if runs its code when the condition is true. else runs when the condition is false. Only one branch runs during a single decision. A temp of -5 means Wear a coat! A temp of 10 means No coat needed! After completing the challenge, try changing temp to 10 and run your code again.",
  "helpExample": "let temp = -5;\n\nif (temp < 0) {\n  print(\"Wear a coat!\");\n} else {\n  print(\"No coat needed!\");\n}",
  "validation": "temperatureIfElse"
}),
  Object.freeze({
  "id": 14,
  "title": "Challenge 14 \u2014 Repeat It!",
  "objective": "Want to repeat something without writing the same code again and again?\n\nUse a for loop to repeat an action.\n\nThe example below prints Hello! three times.\n\nTry changing the number 3 to see what happens!",
  "example": "for (let i = 0; i < 3; i++) {\n  print(\"Hello!\");\n}",
  "help": "A for loop repeats the instructions inside { }. It has three parts: let i = 0 starts counting at zero, i < 3 keeps repeating while the number is below three, and i++ adds one after each repeat.",
  "helpExample": "for (let i = 0; i < 3; i++) {\n  print(\"Hello!\");\n}",
  "validation": "for"
}),
  Object.freeze({
  "id": 15,
  "title": "Challenge 15 \u2014 Make Your Own Function!",
  "objective": "You've already used functions like print() and createCube.\n\nNow it's time to make your own!\n\nA function is a group of instructions you can run whenever you want.\n\nCreate a function and call it to make something happen!",
  "example": "function sayHello() {\n  print(\"Hello from my function!\");\n}\n\nsayHello();",
  "help": "function tells JavaScript you are creating a function. sayHello is the name. () is part of the function declaration and call. { } contains the instructions. Creating a function does not run it automatically, so sayHello(); calls it.",
  "helpExample": "function sayHello() {\n  print(\"Hello from my function!\");\n}\n\nsayHello();",
  "validation": "functionCall"
})
]);
