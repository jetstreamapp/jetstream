-- AlterTable
ALTER TABLE "web_extension_token" ADD COLUMN     "appVersion" VARCHAR(100),
ADD COLUMN     "arch" VARCHAR(100),
ADD COLUMN     "osVersion" VARCHAR(100),
ADD COLUMN     "platform" VARCHAR(100),
ADD COLUMN     "runtimeVersion" VARCHAR(100);
