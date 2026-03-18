CREATE TABLE `acceptance_criteria` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`criteria` json NOT NULL,
	`briefHash` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `acceptance_criteria_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `verification_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`gate` varchar(32) NOT NULL,
	`results` json NOT NULL,
	`overallScore` int NOT NULL,
	`gatePass` int NOT NULL DEFAULT 0,
	`gateThreshold` int NOT NULL,
	`fixRound` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `verification_reports_id` PRIMARY KEY(`id`)
);
