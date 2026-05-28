-- Create Database
CREATE DATABASE IF NOT EXISTS ai_mcp_demo;
USE ai_mcp_demo;

-- Disable foreign key checks for clean teardown
SET FOREIGN_KEY_CHECKS = 0;

-- Drop tables if they exist
DROP TABLE IF EXISTS Orders;
DROP TABLE IF EXISTS Customers;
DROP TABLE IF EXISTS RegistrationDetails;
DROP TABLE IF EXISTS UserNames;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- 1. UserNames Table
CREATE TABLE UserNames (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE
);

-- 2. RegistrationDetails Table
CREATE TABLE RegistrationDetails (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username_id INT NOT NULL,
  age INT NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  registration_date DATE NOT NULL,
  FOREIGN KEY (username_id) REFERENCES UserNames(id) ON DELETE CASCADE
);

-- 3. Customers Table
CREATE TABLE Customers (
  CustomerID INT AUTO_INCREMENT PRIMARY KEY,
  CustomerName VARCHAR(255) NOT NULL,
  ContactName VARCHAR(255),
  City VARCHAR(100),
  Country VARCHAR(100)
);

-- 4. Orders Table
CREATE TABLE Orders (
  OrderID INT AUTO_INCREMENT PRIMARY KEY,
  CustomerID INT,
  OrderDate DATE NOT NULL,
  Amount DECIMAL(10, 2) NOT NULL,
  FOREIGN KEY (CustomerID) REFERENCES Customers(CustomerID) ON DELETE CASCADE
);

-- Seed UserNames
INSERT INTO UserNames (id, username) VALUES 
(1, 'alicesmith'),
(2, 'bobjones'),
(3, 'charliebrown'),
(4, 'dianaprince');

-- Seed RegistrationDetails
INSERT INTO RegistrationDetails (username_id, age, email, registration_date) VALUES
(1, 32, 'alice@example.com', '2026-01-15'),
(2, 28, 'bob@example.com', '2026-02-20'),
(3, 45, 'charlie@example.com', '2026-03-05'),
(4, 29, 'diana@example.com', '2026-04-10');

-- Seed Customers
INSERT INTO Customers (CustomerID, CustomerName, ContactName, City, Country) VALUES
(1, 'Alice Smith', 'Alice S.', 'New York', 'USA'),
(2, 'Bob Jones', 'Bob J.', 'Los Angeles', 'USA'),
(3, 'Charlie Brown', 'Charlie B.', 'Chicago', 'USA'),
(4, 'Diana Prince', 'Diana P.', 'London', 'UK');

-- Seed Orders
INSERT INTO Orders (CustomerID, OrderDate, Amount) VALUES
(1, '2026-05-01', 250.50),
(1, '2026-05-15', 89.99),
(2, '2026-05-10', 1200.00),
(3, '2026-05-12', 45.00),
(4, '2026-05-20', 350.00);
