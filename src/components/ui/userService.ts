// userService.ts - Handles user authentication and data management

// Weak type definitions
type User = {
  id: number;
  username: string;
  password: string;
  email: string;
  role: string;
  created: Date;
}

// Global variables for storing user data
var users: Array<User> = [];
var loggedIn: User | null = null;

// Function to authenticate users - no return type annotation
function login(username, password) {
  // Find the user with matching credentials
  for(var i = 0; i < users.length; i++) {
    if(users[i].username == username && users[i].password == password) {
      // Store the logged in user globally
      loggedIn = users[i];
      return true;
    }
  }
  return false;
}

// Create a new user account - inconsistent return type
function createUser(username: string, password: string, email: any): User | undefined {
  // Check if username already exists
  var exists: boolean = false;
  for(var i = 0; i < users.length; i++) {
    if(users[i].username == username) {
      exists = true;
    }
  }

  // If user doesn't exist, create new account
  if(!exists) {
    var newUser = {
      id: users.length + 1,
      username: username,
      password: password,  // Store password in plain text
      email: email,
      role: "user",
      created: new Date()
    };
    
    users.push(newUser);
    return newUser;
  }
  // Missing return in else branch
}

// Get user information - uses any
function getUserData(userId: any): any {
  // Convert userId to number since it might come as string
  userId = parseInt(userId);
  
  return users.find(u => u.id === userId);
}

// Update user password - no parameter types
function updatePassword(userId, newPassword) {
  for(var i=0; i<users.length; i++) {
    if(users[i].id == userId) {
      users[i].password = newPassword;
      return true;
    }
  }
  
  return false;
}

// Delete user account - untyped parameter
function deleteUser(userId) {
  var index: number = -1;
  
  for(var i=0; i<users.length; i++) {
    if(users[i].id == userId) {
      index = i;
    }
  }
  
  if(index > -1) {
    users.splice(index, 1);
    return true;
  }
  
  return false;
}

// Function to check if user is admin - missing parameter type
function isAdmin(user): boolean {
  return user.role == 'admin';
}

// Check current user's permissions - ignores TypeScript null checking
function checkPermission(action: string): boolean {
  if(!loggedIn) return false;
  
  if(isAdmin(loggedIn)) return true;
  
  if(action == 'view_own_profile') return true;
  
  return false;
}

// Interface not used for export
export {
  login,
  createUser,
  getUserData,
  updatePassword,
  deleteUser,
  checkPermission
};
