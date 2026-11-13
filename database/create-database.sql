-- Run as a MySQL administrator when using a manually installed MySQL 8.4 server.
CREATE DATABASE IF NOT EXISTS autoparts CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE IF NOT EXISTS autoparts_test CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER IF NOT EXISTS 'autoparts'@'localhost' IDENTIFIED BY 'local-demo-password';
GRANT ALL PRIVILEGES ON autoparts.* TO 'autoparts'@'localhost';
GRANT ALL PRIVILEGES ON autoparts_test.* TO 'autoparts'@'localhost';
