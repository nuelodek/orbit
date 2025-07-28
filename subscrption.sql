CREATE TABLE `youtube_subscriptions` (
  `id` int(11) NOT NULL,
  `email` varchar(255) NOT NULL,
  `channel_name` varchar(255) NOT NULL,
  `currency` varchar(3) NOT NULL,
  `perViewRate` decimal(65,4) DEFAULT NULL,
  `channelurl` varchar(255) NOT NULL,
  `channeldescription` text DEFAULT NULL,
  `channelcategory` varchar(255) NOT NULL,
  `splitdollar` decimal(65,4) DEFAULT NULL,
  `splitnaira` decimal(65,4) DEFAULT NULL,
  `subscriptions` int(11) DEFAULT 0,
  `subscriptionneeded` varchar(255) NOT NULL,
  `amountincurred` decimal(65,4) DEFAULT NULL,
  `uploaddate` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

-- YouTube Subscription Count Table
CREATE TABLE `youtubesub_count` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_email` varchar(255) NOT NULL,
  `youtube_subscriptions_id` int(11) NOT NULL,
  `subscription_date` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  FOREIGN KEY (`youtube_subscriptions_id`) REFERENCES `youtube_subscriptions`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `youtubepayments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `youtube_subscriptions_id` int(11) NOT NULL,
  `user_email` varchar(255) NOT NULL,
  `poster_email` varchar(255) NOT NULL,
  `youtube_rate` decimal(65,4) DEFAULT NULL,
  `currency` varchar(3) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- create Table `youtube_subscriptions_log` (
--   `id` int(11) NOT NULL AUTO_INCREMENT,
--   `youtube_subscriptions_id` int(11) NOT NULL,
--   `action` varchar(50) NOT NULL,
--   `user_email` varchar(255) NOT NULL,
--   `timestamp` timestamp NOT NULL DEFAULT current_timestamp(),
  
--   PRIMARY KEY (`id`),
--   FOREIGN KEY (`youtube_subscriptions_id`) REFERENCES `youtube_subscriptions`(`id`)
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;