-- Add Google OAuth fields to growsignup table
ALTER TABLE `growsignup` ADD COLUMN `google_access_token` TEXT NULL AFTER `token_expiry`;
ALTER TABLE `growsignup` ADD COLUMN `google_refresh_token` TEXT NULL AFTER `google_access_token`;
ALTER TABLE `growsignup` ADD COLUMN `google_token_expiry` DATETIME NULL AFTER `google_refresh_token`;
ALTER TABLE `growsignup` ADD COLUMN `youtube_channel_id` VARCHAR(255) NULL AFTER `google_token_expiry`;
ALTER TABLE `growsignup` ADD COLUMN `youtube_channel_name` VARCHAR(255) NULL AFTER `youtube_channel_id`;
ALTER TABLE `growsignup` ADD COLUMN `google_account_linked` TINYINT(1) DEFAULT 0 AFTER `youtube_channel_name`;
ALTER TABLE `growsignup` ADD COLUMN `google_account_email` VARCHAR(255) NULL AFTER `google_account_linked`;

-- Add indexes for better performance
ALTER TABLE `growsignup` ADD INDEX `idx_google_account_email` (`google_account_email`);
ALTER TABLE `growsignup` ADD INDEX `idx_youtube_channel_id` (`youtube_channel_id`);
ALTER TABLE `growsignup` ADD INDEX `idx_google_account_linked` (`google_account_linked`);