ALTER TABLE `agent_logs` MODIFY COLUMN `content` longtext;--> statement-breakpoint
ALTER TABLE `meeting_messages` MODIFY COLUMN `content` longtext NOT NULL;