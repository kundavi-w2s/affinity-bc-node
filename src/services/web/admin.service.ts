import { AdminRepository } from "../../repositories/web/admin.repository";
import { RoleRepository } from "../../repositories/web/role.repository";
import { ProfileRepository } from "../../repositories/mobile/profile.repository";
import dotenv from 'dotenv';
import { APP_CONSTANTS, DEFAULT_CONFIG, USER_FILTERS } from "../../utils/constants";
import { APILogger } from "../../utils/logger";
import { EmailSender, SendEmailResult } from "../../utils/emailSender";
import { getSignedUrl } from "../../utils/formatImage";
import { decryptPassword, encryptPassword, generateJWT } from "../../utils/password_convertion";
import { generateOTP } from "../../utils/helper";
import { UserRepository } from "../../repositories/mobile/users.repository";
import { infoRepository } from "../../repositories/mobile/info.repository";
import { SendNotification } from "../../utils/notification";
import { getSocket } from "../../utils/socket";
import Admin from "../../models/admin_model";
dotenv.config();

export class AdminService {
    private AdminRepository: AdminRepository
    private RoleRepository: RoleRepository
    private logger: APILogger
    private emailSender: EmailSender
    private UserRepository: UserRepository
    private infoRepository: infoRepository;
    private profileRepository: ProfileRepository;
    constructor() {
        this.AdminRepository = new AdminRepository();
        this.RoleRepository = new RoleRepository();
        this.logger = new APILogger();
        this.emailSender = new EmailSender();
        this.UserRepository = new UserRepository();
        this.infoRepository = new infoRepository();
        this.profileRepository = new ProfileRepository();
    }
    registerAdmin = async (req: any) => {
        try {
            const Admin_name = req.body.full_name;
            const email = req.body.email;
            const encryptedPassword = req.body.new_password;

            const encryptionKey = process.env.CRYPTO_SECRET_KEY || DEFAULT_CONFIG.ENCRYPT_KEY;

            // Decrypt password (sent encrypted from frontend)
            const decrypted_password = decryptPassword(encryptedPassword, encryptionKey);

            if (!decrypted_password) {
                return {
                    message: APP_CONSTANTS.message.invalid_password_encryption,
                    status: false,
                    responseCode: APP_CONSTANTS.code.status_badrequest_code
                };
            }

            // Check if admin already exists
            const existing_user = await this.AdminRepository.checkAdmin(email);
            if (existing_user) {
                return {
                    message: APP_CONSTANTS.message.email_exist,
                    status: false,
                    responseCode: APP_CONSTANTS.code.status_badrequest_code
                };
            }

            // Re-encrypt the decrypted password for DB storage
            const storedPassword = encryptPassword(decrypted_password, encryptionKey);
            const is_account_owner = true;

            // Create admin
            const createdAdmin = await this.AdminRepository.createAdmin(
                Admin_name,
                email,
                storedPassword,
                is_account_owner
            );

            // Fixed: You had no return if createAdmin fails or returns falsy
            if (!createdAdmin) {
                return {
                    message: APP_CONSTANTS.message.something_went_wrong,
                    status: false,
                    responseCode: APP_CONSTANTS.code.status_internal_server
                };
            }

            // Success - exact same as before
            return {
                message: APP_CONSTANTS.message.admin_register_success,
                status: true,
                responseCode: APP_CONSTANTS.code.status_success_code
            };

        } catch (error) {
            // This was already correct
            return {
                message: APP_CONSTANTS.message.something_went_wrong,
                status: false,
                responseCode: APP_CONSTANTS.code.status_internal_server
            };
        }
    };

    createAdmin = async (req: any) => {
        try {
            const admin_name = req.body.admin_name;
            const admin_email = req.body.email;
            const role = req.body.admin_role;
            const existing_user: any = await this.AdminRepository.checkAdmin(admin_email);

            if (!existing_user) {
                await this.AdminRepository.createAdminuser(admin_name, admin_email, role);
                // Emit socket event for real-time update
                const io = getSocket();
                if (io) {
                    io.sockets.emit(APP_CONSTANTS.socket_fields.adminCreated, { admin_name, admin_email, role });
                } else {
                    console.warn('[SOCKET] Socket not initialized when emitting adminCreated event');
                }
                return {
                    message: APP_CONSTANTS.message.admin_create_success,
                    status: true,
                    responseCode: APP_CONSTANTS.code.status_success_code,
                };
            } else {
                return {
                    message: APP_CONSTANTS.message.email_exist,
                    status: false,
                    responseCode: APP_CONSTANTS.code.status_internal_server,
                };
            }
        } catch (error) {
            return {
                message: APP_CONSTANTS.message.something_went_wrong,
                status: false,
                responseCode: APP_CONSTANTS.code.status_internal_server,
            };
        }
    };

    adminLogin = async (req: any) => {
        try {
            const admin_email = req.body.email;
            const encryptedPassword = req.body.password;
            const encryptionKey = process.env.CRYPTO_SECRET_KEY || DEFAULT_CONFIG.ENCRYPT_KEY;

            const existing_user: any = await this.AdminRepository.checkAdmin(admin_email);

            if (!existing_user) {
                return {
                    message: APP_CONSTANTS.message.email_not_register,
                    status: false,
                    responseCode: APP_CONSTANTS.code.status_badrequest_code
                };
            }
            const stored_decrypted_password = decryptPassword(existing_user.password, encryptionKey);


            if (stored_decrypted_password !== encryptedPassword) {
                return {
                    message: APP_CONSTANTS.message.invalid_credential,
                    status: false,
                    responseCode: APP_CONSTANTS.code.status_badrequest_code
                };
            }

            const jwtSecret = process.env.JWT_SECRET || DEFAULT_CONFIG.JWT_SECRET;
            const jwtExpiry = process.env.JWT_EXPIRY || DEFAULT_CONFIG.EXPIRY_TIME;
            const REFRESH_SECRET: any = process.env.REFRESH_SECRET || DEFAULT_CONFIG.REFRESH_SECRET;
            const REFRESH_EXPIRY: any = process.env.REFRESH_EXPIRY || DEFAULT_CONFIG.REFRESH_EXPIRY;

            const accessToken = generateJWT(
                { email: existing_user.email, id: existing_user.id },
                jwtSecret,
                jwtExpiry
            );

            const refreshToken = generateJWT(
                { email: existing_user.email, id: existing_user.id },
                REFRESH_SECRET,
                REFRESH_EXPIRY
            );

            return {
                message: APP_CONSTANTS.message.login_success,
                accessToken,
                refreshToken,
                status: true,
                responseCode: APP_CONSTANTS.code.status_success_code
            };

        } catch (error) {
            return {
                message: APP_CONSTANTS.message.something_went_wrong,
                status: false,
                responseCode: APP_CONSTANTS.code.status_internal_server
            };
        }
    };



    getAdminuser = async (req: any): Promise<any | null> => {
        try {
            const admin_id = req.userId;

            if (!admin_id) {
                return {
                    message: APP_CONSTANTS.message.unauthorized_user,
                    status: false,
                    responseCode: APP_CONSTANTS.code.status_unauthorize_code
                };
            }

            const subscription_data = await this.AdminRepository.getAdminuserbyId(admin_id);

            if (!subscription_data) {
                return {
                    message: APP_CONSTANTS.message.user_not_found,
                    status: false,
                    responseCode: APP_CONSTANTS.code.status_notfound_code
                };
            }

            let admin_detail = subscription_data.toJSON();
            const role_id = admin_detail?.role_id;

            if (!role_id) {
                return {
                    message: APP_CONSTANTS.message.role_not_assigned,
                    status: false,
                    responseCode: APP_CONSTANTS.code.status_badrequest_code
                };
            }

            // Optional: verify role exists (remove if not needed)
            const role = await this.RoleRepository.getRolebyId(role_id);
            if (!role) {
                return {
                    message: APP_CONSTANTS.message.invalid_role_assigned,
                    status: false,
                    responseCode: APP_CONSTANTS.code.status_badrequest_code
                };
            }

            const permissions = await this.RoleRepository.getPermissionListById(role_id);

            // Group permissions by category
            const final_result: { category: string; permissions: string[] }[] = [];

            permissions.forEach((obj: any) => {
                const categoryObj = final_result.find(cat => cat.category === obj.category);
                if (categoryObj) {
                    categoryObj.permissions.push(obj.permission_name);
                } else {
                    final_result.push({
                        category: obj.category,
                        permissions: [obj.permission_name]
                    });
                }
            });

            admin_detail.permissions = final_result;

            return {
                result: admin_detail,
                message: APP_CONSTANTS.message.data_fetched,
                status: true,
                responseCode: APP_CONSTANTS.code.status_success_code
            };

        } catch (error) {
            console.error("Error in getAdminuser:", error);
            return {
                message: APP_CONSTANTS.message.something_went_wrong,
                status: false,
                responseCode: APP_CONSTANTS.code.status_internal_server
            };
        }
    }

    getAllAdmin = async (req: any) => {
        try {
            const page = req.query.page ? parseInt(req.query.page as string) : 1;
            const limit = req.query.perPage ? parseInt(req.query.perPage as string) : 10;
            const { data: admins, total, totalPages, currentPage } = await this.AdminRepository.getAlladmins(page, limit);

            const updatedAdmins = await Promise.all(
                admins.map(async (admin: any) => {
                    let role_name = "";
                    if (admin.role_id) {
                        const role: any = await this.RoleRepository.getRolebyId(admin.role_id);
                        if (role) role_name = role.name;
                    }

                    return {
                        ...admin.toJSON(),
                        role_name
                    };
                })
            );

            return {
                result: {
                    data: updatedAdmins,
                    total,
                    totalPages,
                    currentPage,
                    limit
                },
                message: APP_CONSTANTS.message.data_fetched,
                status: true,
                responseCode: APP_CONSTANTS.code.status_success_code
            };

        } catch (error) {
            console.error("Error in getAllAdmin:", error);
            return {
                message: APP_CONSTANTS.message.something_went_wrong,
                status: false,
                responseCode: APP_CONSTANTS.code.status_internal_server
            };
        }
    };


    resetPassword = async (req: any) => {
    try {
        const { email } = req.body;

        if (!email) {
            return {
                message: APP_CONSTANTS.message.email_does_not_exist,
                status: false,
                responseCode: APP_CONSTANTS.code.status_notfound_code
            };
        }

        const existing_user: any = await this.AdminRepository.checkAdmin(email);
        if (!existing_user) {
            return {
                message: APP_CONSTANTS.message.email_does_not_exist,
                status: false,
                responseCode: APP_CONSTANTS.code.status_notfound_code
            };
        }

        //  Generate 4-digit OTP
        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        existing_user.otp = otp;
        existing_user.otp_expire_time = expiresAt;
        await existing_user.save();

        const subject = 'Password Reset OTP';
        const text = `Your OTP is ${otp}. It will expire in 10 minutes.`;

        const sent = await this.emailSender.sendEmail(
            existing_user.email,
            subject,
            text
        );

        if (!sent) {
            return {
                message: APP_CONSTANTS.message.failed_to_send_otp,
                status: false,
                responseCode: APP_CONSTANTS.code.status_internal_server
            };
        }

        return {
            message: APP_CONSTANTS.message.otp_message_email,
            status: true,
            responseCode: APP_CONSTANTS.code.status_success_code
        };

    } catch (error: any) {
        this.logger.error(error?.message || error);
        return {
            message: APP_CONSTANTS.message.something_went_wrong,
            status: false,
            responseCode: APP_CONSTANTS.code.status_internal_server
        };
    }
};

    verifyOtp = async (req: any) => {
        try {
            const { email, otp } = req.body;

            if (!email || !otp) {
                return {
                    message: APP_CONSTANTS.message.email_and_otp_req,
                    status: false,
                    responseCode: APP_CONSTANTS.code.status_notfound_code
                };
            }

            const existing_user: any = await this.AdminRepository.checkAdmin(email);
            if (!existing_user || !existing_user.otp) {
                return {
                    message: APP_CONSTANTS.message.invalid_otp,
                    status: false,
                    responseCode: APP_CONSTANTS.code.status_notfound_code
                };
            }

            if (new Date() > existing_user.otp_expire_time) {
                return {
                    message: APP_CONSTANTS.message.otp_expired,
                    status: false,
                    responseCode: APP_CONSTANTS.code.status_unauthorize_code
                };
            }

            if (otp !== existing_user.otp) {
                return {
                    message: APP_CONSTANTS.message.invalid_otp,
                    status: false,
                    responseCode: APP_CONSTANTS.code.status_unauthorize_code
                };
            }

            existing_user.otp = null;
            existing_user.otp_expire_time = null;
            await existing_user.save();

            return {
                message: APP_CONSTANTS.message.otp_verified,
                status: true,
                responseCode: APP_CONSTANTS.code.status_success_code
            };

        } catch (error) {
            return {
                message: APP_CONSTANTS.message.something_went_wrong,
                status: false,
                responseCode: APP_CONSTANTS.code.status_internal_server
            };
        }
    };

    changePassword = async (req: any) => {
        try {
            const decrypted_new_password = req.body.new_password;
            const admin_email = req.body.email;

            const encryptionKey = process.env.CRYPTO_SECRET_KEY || DEFAULT_CONFIG.ENCRYPT_KEY;

            if (!decrypted_new_password) {
                return {
                    message: APP_CONSTANTS.message.invalid_password_decryption,
                    status: false,
                    responseCode: APP_CONSTANTS.code.status_badrequest_code
                };
            }

            // Check if admin exists
            const existing_user: any = await this.AdminRepository.checkAdmin(admin_email);

            if (!existing_user) {
                return {
                    message: APP_CONSTANTS.message.email_not_register,
                    status: false,
                    responseCode: APP_CONSTANTS.code.status_badrequest_code
                };
            }

            const encrypted_password_to_store = encryptPassword(decrypted_new_password, encryptionKey)

            const result = await this.AdminRepository.updateAdminPassword(
                existing_user.id,
                encrypted_password_to_store
            );

            if (!result || !result.success) {
                return {
                    message: result?.message || APP_CONSTANTS.message.something_went_wrong,
                    status: false,
                    responseCode: APP_CONSTANTS.code.status_internal_server
                };
            }

            return {
                message: APP_CONSTANTS.message.password_update_success,
                status: true,
                responseCode: APP_CONSTANTS.code.status_success_code
            };

        } catch (error) {
            return {
                message: APP_CONSTANTS.message.something_went_wrong,
                status: false,
                responseCode: APP_CONSTANTS.code.status_internal_server
            };
        }
    };


    getUsersList = async (req: any) => {
        try {
            const page = req.query.page ? parseInt(req.query.page as string) : 1;
            const perPage = req.query.perPage ? parseInt(req.query.perPage as string) : null;
            const is_active = req.query.is_active as boolean | undefined; 
            const search = req.query.search as string | undefined; 
            const startDate = req.query.startDate
            const endDate = req.query.endDate

            const userList = await this.AdminRepository.getUsersList(page, perPage, is_active, search, startDate, endDate);

            return {
                result: userList,
                message: APP_CONSTANTS.message.data_fetched,
                status: true,
                responseCode: APP_CONSTANTS.code.status_success_code
            };
        } catch (error) {
            const errorMsg = (error && typeof error === 'object' && 'message' in error) ? (error as any).message : String(error);
            this.logger.error(errorMsg);
            return {
                message: APP_CONSTANTS.message.something_went_wrong,
                status: false,
                responseCode: APP_CONSTANTS.code.status_internal_server
            };
        }
    };

  getUserDetails = async (req: any) => {
    try {
        const userId = req.params.id;

        const userInstance = await this.profileRepository.getByUserId(userId);

        if (!userInstance || !userInstance.success) {
            return {
                message: APP_CONSTANTS.message.user_not_found,
                status: false,
                responseCode: APP_CONSTANTS.code.status_notfound_code
            };
        }

        // Convert profile to plain object
        const profile = userInstance.profile?.toJSON
            ? userInstance.profile.toJSON()
            : userInstance.profile;

        // Format images with signed URLs
        if (profile && Array.isArray(profile.images) && profile.images.length > 0) {
            profile.images.sort(
                (a: any, b: any) =>
                    (a.order_index ?? 999) - (b.order_index ?? 999)
            );

            profile.images = await Promise.all(
                profile.images.map(async (imgObj: any) => {
                    const img = imgObj?.toJSON ? imgObj.toJSON() : imgObj;

                    if (!img.image_url) return img;

                    const { status, data } = await getSignedUrl(img.image_url);

                    return {
                        ...img,
                        image_url: status && data ? data : img.image_url
                    };
                })
            );
        }

        return {
            result: {
                profile: profile
            },
            message: APP_CONSTANTS.message.data_fetched,
            status: true,
            responseCode: APP_CONSTANTS.code.status_success_code
        };
    } catch (error) {
        this.logger.error("Error in getUserDetails:", error);

        return {
            message: APP_CONSTANTS.message.something_went_wrong,
            status: false,
            responseCode: APP_CONSTANTS.code.status_internal_server
        };
    }
};


    updateUserStatus = async (req: any) => {
        try {
            const userId = req.params.id;
            const { is_active } = req.body;

            if (typeof is_active !== 'boolean') {
                return {
                    message: 'Invalid status value',
                    status: false,
                    responseCode: APP_CONSTANTS.code.status_badrequest_code
                };
            }

            const result = await this.AdminRepository.updateUserStatus(userId, is_active);

            if (!result || result[0] === 0) {
                return {
                    message: APP_CONSTANTS.message.user_not_found,
                    status: false,
                    responseCode: APP_CONSTANTS.code.status_notfound_code
                };
            }

            // Emit socket event for real-time update
            const io = getSocket();
            if (io) {
                io.sockets.emit(APP_CONSTANTS.socket_fields.userStatusUpdated, { userId, is_active });
            } else {
                console.warn('⚠️ [SOCKET] Socket not initialized when emitting userStatusUpdated event');
            }

            return {
                message: `User has been ${is_active ? 'activated' : 'deactivated'} successfully`,
                status: true,
                responseCode: APP_CONSTANTS.code.status_success_code
            };
        } catch (error) {
            console.error('Error in updateUserStatus:', error);
            return {
                message: APP_CONSTANTS.message.something_went_wrong,
                status: false,
                responseCode: APP_CONSTANTS.code.status_internal_server
            };
        }
    };

    deleteUser = async (req: any) => {
        try {
            const userId = req.params.id;

            const userInstance = await this.profileRepository.getByUserId(userId);
            if (!userInstance) {
                return {
                    message: APP_CONSTANTS.message.user_not_found,
                    status: false,
                    responseCode: APP_CONSTANTS.code.status_notfound_code
                };
            }

            const user = userInstance.profile?.toJSON
            ? userInstance.profile.toJSON()
            : userInstance.profile;
            const userEmail = user?.user?.email;

            const adminId = req.userId || null;
            const result = await this.AdminRepository.deleteUser(userId, APP_CONSTANTS.action.admin, adminId);
            if (!result || result[0] === 0) {
                return {
                    message: APP_CONSTANTS.message.something_went_wrong,
                    status: false,
                    responseCode: APP_CONSTANTS.code.status_internal_server
                };
            }

            // Emit socket event for real-time update
            const io = getSocket();
            if (io) {
                io.sockets.emit(APP_CONSTANTS.socket_fields.userDeleted, { 
                    userId, 
                    deletedBy: APP_CONSTANTS.action.admin,
                    adminId,
                    userEmail
                });
            } else {
                console.warn('[SOCKET] Socket not initialized when emitting userDeleted event');
            }

            // Send deletion notification email (async, non-blocking)
            if (userEmail && result[0] === 1) {
                const subject = APP_CONSTANTS.message.account_delete_sub;
                const text = APP_CONSTANTS.message.account_delete_msg;
                
                this.emailSender.sendEmail(userEmail, subject, text).catch((err: any) => {
                    console.error('Failed to send deletion email:', err);
                });
            }

            return {
                message: APP_CONSTANTS.message.account_del,
                status: true,
                responseCode: APP_CONSTANTS.code.status_success_code
            };
        } catch (error: any) {
            console.error(APP_CONSTANTS.message.err_delete, error);
            return {
                message: APP_CONSTANTS.message.something_went_wrong,
                status: false,
                responseCode: APP_CONSTANTS.code.status_internal_server
            };
        }
    };

    /** Restore a soft-deleted user (admin action) */
    restoreUser = async (req: any) => {
        try {
            const userId = req.params.id;
            const userInstance = await this.profileRepository.getByUserId(userId);
            if (!userInstance) {
                return {
                    message: APP_CONSTANTS.message.user_not_found,
                    status: false,
                    responseCode: APP_CONSTANTS.code.status_notfound_code
                };
            }
            const result = await this.AdminRepository.restoreUser(userId);
            if (!result) {
                return {
                    message: APP_CONSTANTS.message.something_went_wrong,
                    status: false,
                    responseCode: APP_CONSTANTS.code.status_internal_server
                };
            }
            return {
                message: APP_CONSTANTS.message.undelete,
                status: true,
                responseCode: APP_CONSTANTS.code.status_success_code
            };
        } catch (error: any) {
            console.error(APP_CONSTANTS.message.restore_err, error);
            return {
                message: APP_CONSTANTS.message.something_went_wrong,
                status: false,
                responseCode: APP_CONSTANTS.code.status_internal_server
            };
        }
    };

    triggerNotification = async (req: any) => {
        try {
            const { title, message, trigger_to, city, state } = req.body;
            if (!title || !message) {
                return {
                    message: APP_CONSTANTS.message.title_and_message_required,
                    status: false,
                    responseCode: APP_CONSTANTS.code.status_badrequest_code
                };
            }
            // Validate trigger_to
            const validTriggers = [APP_CONSTANTS.action.active, APP_CONSTANTS.action.inactive, APP_CONSTANTS.action.all];
            if (!trigger_to) {
                //|| typeof trigger_to !== 'string'
                return {
                    message: APP_CONSTANTS.message.trigger_to_required_and_must_string,
                    status: false,
                    responseCode: APP_CONSTANTS.code.status_badrequest_code
                };
            }
            if (!validTriggers.includes(trigger_to)) {
                return {
                    message: APP_CONSTANTS.message.Invalid_trigger_to_Allowed_values,
                    status: false,
                    responseCode: APP_CONSTANTS.code.status_badrequest_code
                };
            }

            const isActiveFilter: boolean | null =
                trigger_to === APP_CONSTANTS.action.active ? true :
                    trigger_to === APP_CONSTANTS.action.inactive ? false : null;
            const notificationObject = {
                notification_title: title,
                notification_message: message,
                trigger_to: trigger_to,
                city: city || null,
                state: state || null
            };
            await this.AdminRepository.createAdminnotification(notificationObject);
            const users = await this.AdminRepository.getAllUsers(isActiveFilter, city, state);
            if (!users || users.length === 0) {
                return {
                    message: `No users found matching the filters (trigger_to: ${trigger_to}, city: ${city || 'any'}, state: ${state || 'any'}).`,
                    status: false,
                    responseCode: APP_CONSTANTS.code.status_notdatafound_code
                };
            }
            const sendNotif = new SendNotification();
            for (const user of users) {
                if (user?.device_token && typeof user.device_token === 'string' && user.device_token.trim()) {
                    await sendNotif.sendpushNotification(
                        user.device_token.trim(),
                        {
                            title: title,
                            body: message
                        }
                    );
                }
            }
            return {
                message: APP_CONSTANTS.message.Notifications_processed_successfully,
                status: true,
                responseCode: APP_CONSTANTS.code.status_success_code
            };
        } catch (error: any) {
            this.logger.error(`Error in triggerNotification: ${error.message || error}`);
            return {
                message: APP_CONSTANTS.message.something_went_wrong,
                status: false,
                responseCode: APP_CONSTANTS.code.status_internal_server
            };
        }
    };

    getReportList = async (req: any) => {
        try {
            const page = req.query.page ? parseInt(req.query.page as string) : 1;
            const perPage = req.query.perPage ? parseInt(req.query.perPage as string) : 10;

            const search = req.query.search
                ? (req.query.search as string).trim()
                : undefined;

            const is_active = req.query.is_active as string | undefined;
              const startDate = req.query.startDate
            const endDate = req.query.endDate

            const reportList = await this.infoRepository.getReportedUsers(
                page,
                perPage,
                search,
                is_active,
                startDate,
                endDate
            );

            if (reportList.data && reportList.data.length > 0) {
                reportList.data.forEach((report: any) => {
                    report.reporter_name = report.reporter?.profile ? `${report.reporter.profile.first_name || ''} ${report.reporter.profile.last_name || ''}`.trim() || '' : '';
                    report.reported_name = report.reported?.profile ? `${report.reported.profile.first_name || ''} ${report.reported.profile.last_name || ''}`.trim() || '' : '';
                });
            }

            return {
                result: reportList,
                message: APP_CONSTANTS.message.reports_fetched,
                status: true,
                responseCode: APP_CONSTANTS.code.status_success_code
            };

        } catch (error) {
            const errorMsg =
                error && typeof error === 'object' && 'message' in error
                    ? (error as any).message
                    : String(error);

            this.logger.error(errorMsg);

            return {
                message: APP_CONSTANTS.message.failed_to_fetch_reports,
                status: false,
                responseCode: APP_CONSTANTS.code.status_internal_server
            };
        }
    };

    getHelpSupportList = async (req: any) => {
        try {

            const page = req.query.page ? parseInt(req.query.page as string) : 1;
            const perPage = req.query.perPage ? parseInt(req.query.perPage as string) : 10;
            const search = req.query.search ? (req.query.search as string).trim() : undefined;
            const is_active = req.query.is_active as string | undefined;
              const startDate = req.query.startDate
            const endDate = req.query.endDate

            const getHelpSupportList = await this.infoRepository.getHelpSupportList(page, perPage, search, is_active, startDate, endDate);

            if (getHelpSupportList.data && getHelpSupportList.data.length > 0) {
                getHelpSupportList.data.forEach((report: any) => {
                    report.sender_name = report.user?.profile ? `${report.user.profile.first_name || ''} ${report.user.profile.last_name || ''}`.trim() || '' : '';
                });
            }


            return {
                result: getHelpSupportList,
                message: APP_CONSTANTS.message.reports_fetched,
                status: true,
                responseCode: APP_CONSTANTS.code.status_success_code
            };

        } catch (error) {
            console.error(APP_CONSTANTS.message.help_and_support, error);
            return {
                message: APP_CONSTANTS.message.help_and_support,
                status: false,
                responseCode: APP_CONSTANTS.code.status_internal_server
            };
        }
    };
    getDashboardList = async (req: any) => {
        try {
            const startDate = req.query.startDate
            const endDate = req.query.endDate
            const dashboardData = await this.infoRepository.getDashboardList(startDate, endDate);
            if (!dashboardData.success) {
                return {
                    message: APP_CONSTANTS.message.Failed_to_fetch_dashboard_data,
                    status: false,
                    responseCode: APP_CONSTANTS.code.status_internal_server
                };
            }
            return {
                result: dashboardData.data,
                message: APP_CONSTANTS.message.fetch_success,
                status: true,
                responseCode: APP_CONSTANTS.code.status_success_code
            };
        } catch (error) {
            console.error(APP_CONSTANTS.message.Failed_to_fetch_dashboard_data, error);
            return {
                message: APP_CONSTANTS.message.failed_to_fetch_reports,
                status: false,
                responseCode: APP_CONSTANTS.code.status_internal_server
            };
        }
    };
    getFilterList = async (req: any) => {
        try {
            const filterData: any = await this.infoRepository.getFilterList();

            return {
                result: filterData?.result,
                message: filterData?.message,
                status: filterData?.status,
                responseCode: filterData?.responseCode
            };
        } catch (error: any) {
            console.error(APP_CONSTANTS.message.filter_err, error);
            return {
                message: APP_CONSTANTS.message.something_went_wrong,
                status: false,
                responseCode: APP_CONSTANTS.code.status_internal_server
            };
        }
    }

    getNotificationList = async (req: any) => {
        try {
            const page = req.query.page ? parseInt(req.query.page as string) : 1;
            const perPage = req.query.perPage ? parseInt(req.query.perPage as string) : 10;
            const search = req.query.search ? (req.query.search as string).trim() : undefined;
            const trigger_to = req.query.trigger_to ? (req.query.trigger_to as string).trim() : undefined;
              const startDate = req.query.startDate
            const endDate = req.query.endDate
            const notificationlist: any = await this.infoRepository.getNotificationList(page, perPage, search, trigger_to, startDate, endDate);
            return {
                result: notificationlist,
                message: APP_CONSTANTS.message.data_fetched,
                status: true,
                responseCode: APP_CONSTANTS.code.status_success_code
            };
        } catch (error: any) {
            console.error(APP_CONSTANTS.message.get_notification, error);
            return {
                message: APP_CONSTANTS.message.something_went_wrong,
                status: false,
                responseCode: APP_CONSTANTS.code.status_internal_server
            };
        }
    }

    deleteAdmin = async (req: any) => {
        try {
            const adminId = req.params.id;

            if (!adminId) {
                return {
                    message: APP_CONSTANTS.message.invalid_request,
                    status: false,
                    responseCode: APP_CONSTANTS.code.status_badrequest_code
                };
            }

            const admin = await this.AdminRepository.findById(adminId);

            if (admin) {
                await Admin.update({ is_active: false }, { where: { id: adminId } });

                return {
                    message: APP_CONSTANTS.message.admin_deleted_successfully,
                    status: true,
                    responseCode: APP_CONSTANTS.code.status_success_code
                };
            }
            else {
                return {
                    message: APP_CONSTANTS.message.admin_not_found,
                    status: false,
                    responseCode: APP_CONSTANTS.code.status_notfound_code
                };
            }
        } catch (error: any) {
            this.logger.error(`Delete admin error: ${error.message}`);
            return {
                message: APP_CONSTANTS.message.something_went_wrong,
                status: false,
                responseCode: APP_CONSTANTS.code.status_internal_server
            };
        }
    }

    getUserFilterList = async (req: any) => {
        try {
            const filter = req.query.filter;
            const page = req.query.page ? parseInt(req.query.page) : 1;
            const perPage = req.query.perPage ? parseInt(req.query.perPage) : null;
            const search = req.query.search || '';
            const startDate = req.query.startDate;
            const endDate = req.query.endDate;

            if (!filter) {
                return {
                    message: APP_CONSTANTS.message.Filter_parameter_required,
                    status: false,
                    responseCode: APP_CONSTANTS.code.status_badrequest_code
                };
            }

            const validFilters = Object.values(USER_FILTERS);
            if (!validFilters.includes(filter)) {
                return {
                    message: `Invalid filter value. Must be one of: ${validFilters.join(', ')}`,
                    status: false,
                    responseCode: APP_CONSTANTS.code.status_badrequest_code
                };
            }

            const filterList = await this.AdminRepository.getUserFilterList(filter, page, perPage, search, startDate, endDate);

            return {
                result: {
                    data: filterList.data,
                    total: filterList.total,
                    totalPages: filterList.totalPages,
                    currentPage: filterList.currentPage,
                    limit: perPage
                },
                message: APP_CONSTANTS.message.data_fetched,
                status: true,
                responseCode: APP_CONSTANTS.code.status_success_code
            };
        } catch (error:any) {
           
            this.logger.error(error?.message);
            return {
                message: APP_CONSTANTS.message.something_went_wrong,
                status: false,
                responseCode: APP_CONSTANTS.code.status_internal_server
            };
        }
    }
};


