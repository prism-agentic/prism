CREATE TABLE `message_feedback` (
	`id` int AUTO_INCREMENT NOT NULL,
	`messageId` int NOT NULL,
	`userId` int NOT NULL,
	`rating` enum('satisfied','unsatisfied') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `message_feedback_id` PRIMARY KEY(`id`)
);
