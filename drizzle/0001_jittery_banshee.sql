CREATE TABLE `agent_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`agentName` varchar(64) NOT NULL,
	`agentRole` varchar(64) NOT NULL,
	`phase` int DEFAULT 0,
	`action` varchar(128),
	`content` text,
	`status` enum('thinking','working','reviewing','done','error') NOT NULL DEFAULT 'thinking',
	`durationMs` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(200) NOT NULL,
	`description` text,
	`template` varchar(64) DEFAULT 'custom',
	`status` enum('idle','running','completed','failed') NOT NULL DEFAULT 'idle',
	`agentConfig` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`userId` int NOT NULL,
	`prompt` text NOT NULL,
	`status` enum('pending','running','completed','failed') NOT NULL DEFAULT 'pending',
	`currentPhase` int DEFAULT 0,
	`totalPhases` int DEFAULT 6,
	`result` json,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tasks_id` PRIMARY KEY(`id`)
);
