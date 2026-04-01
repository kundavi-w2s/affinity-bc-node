import User from "../models/user";
import UserLocation from "../models/user_location";
import UserProfile from "../models/user_profile";

export interface UserWithProfile extends User {
  profile?: UserProfile;
  UserLocation?: UserLocation;
}