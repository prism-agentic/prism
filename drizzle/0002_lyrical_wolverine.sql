CREATE TABLE `meeting_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`sender` varchar(32) NOT NULL,
	`round` int NOT NULL DEFAULT 1,
	`content` text NOT NULL,
	`messageType` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `meeting_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `tasks` MODIFY COLUMN `status` enum('pending','running','clarifying','completed','failed') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `tasks` ADD `requirementsBrief` json;--> statement-breakpoint
ALTER TABLE `tasks` ADD `meetingRound` int DEFAULT 0;