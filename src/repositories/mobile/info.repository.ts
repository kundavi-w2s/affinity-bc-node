import AdminNotification from "../../models/admin_notification";
import BlockedUser from "../../models/blocked_user";
import HelpSupportMaster from "../../models/help_support_master";
import LikedProfile from "../../models/liked_profile";
import ReportUser from "../../models/report_user";
import User from "../../models/user";
import UserLocation from "../../models/user_location";
import UserProfile from "../../models/user_profile";
import ChatHistory from "../../models/chat_history";
import { ADMIN_FIELDS, APP_CONSTANTS, USER_EXTRA_FIELDS, PROFILE_FIELDS, USER_ASSOCIATIONS, NOTIFICATION_FIELDS, CHAT_HISTORY } from "../../utils/constants";
import { PaginationUtil } from "../../utils/pagination";
import { Op, Sequelize } from 'sequelize';

export class infoRepository {
    helpAndsupport = async (user_id: number, issue_description: string) => {
        HelpSupportMaster.create({
            user_id: user_id,
            issue_description: issue_description
        })
    }

    getReportedUsers = async (  
        page: number,
        perpage: number,
        search?: string,
        is_active?: string,
        startDate?: string,
        endDate?: string
    ) => {
        try {
            let whereClause: any = {};

            if (search) {
                let searchConditions: any[] = [
                    { reason: { [Op.like]: `%${search}%` } },
                    { description: { [Op.like]: `%${search}%` } },
                    { [`$${USER_ASSOCIATIONS.REPORTER}.profile.first_name$`]: { [Op.like]: `%${search}%` } },
                    { [`$${USER_ASSOCIATIONS.REPORTER}.profile.last_name$`]: { [Op.like]: `%${search}%` } },
                    { [`$${USER_ASSOCIATIONS.REPORTED}.profile.first_name$`]: { [Op.like]: `%${search}%` } },
                    { [`$${USER_ASSOCIATIONS.REPORTED}.profile.last_name$`]: { [Op.like]: `%${search}%` } },
                ];
                if (!isNaN(parseInt(search))) {
                    searchConditions.push({ reported_user_id: { [Op.eq]: parseInt(search) } });
                }
                whereClause[Op.or] = searchConditions;
            }
            if (startDate && endDate) {
                const start = new Date(startDate);
                const end = new Date(endDate);
                whereClause.created_at = {
                    [Op.gte]: start,
                    [Op.lte]: end
                };
            }

            const status = is_active?.toLowerCase();
            let reporterWhere: any = {};
            let reportedWhere: any = {};
            if (status === APP_CONSTANTS.action.active || status === APP_CONSTANTS.action.inactive) {
                const active = status === APP_CONSTANTS.action.active;
                reporterWhere.is_active = active;
                reportedWhere.is_active = active;
            }

            const createUserInclude = (as: string, where: any) => ({
                model: User,
                as,
                attributes: [USER_EXTRA_FIELDS.ID, ADMIN_FIELDS.EMAIL],
                where,
                required: true,
                include: [{
                    model: UserProfile,
                    as: PROFILE_FIELDS.OPTIONAL.PROFILE,
                    attributes: [PROFILE_FIELDS.MANDATORY.FIRST_NAME, PROFILE_FIELDS.MANDATORY.LAST_NAME, PROFILE_FIELDS.OPTIONAL.PROFILE_ID]
                }]
            });

            const result = await PaginationUtil.paginate(ReportUser, {
                page,
                limit: perpage,
                where: whereClause,
                include: [
                    createUserInclude(USER_ASSOCIATIONS.REPORTER, reporterWhere),
                    createUserInclude(USER_ASSOCIATIONS.REPORTED, reportedWhere)
                ],
                order: [[USER_EXTRA_FIELDS.CREATED_AT, USER_EXTRA_FIELDS.DESC]],
            });

            return result;
        } catch (error: any) {
            console.error(APP_CONSTANTS.message.get_report_user_err, error);
            return {
                success: false,
                error: error.message || APP_CONSTANTS.message.get_report_user_err,
                data: null,
            };
        }
    };


    getHelpSupportList = async (
        page: number,
        perpage: number,
        search?: string,
        is_active?: string,
        startDate?: string,
        endDate?: string
    ) => {
        try {
            let whereClause: any = {};

            if (search) {
                whereClause[Op.or] = [
                    { issue_description: { [Op.like]: `%${search}%` } },
                    { [`$${USER_ASSOCIATIONS.USER}.profile.first_name$`]: { [Op.like]: `%${search}%` } },
                    { [`$${USER_ASSOCIATIONS.USER}.profile.last_name$`]: { [Op.like]: `%${search}%` } },
                ];
            }

            if (startDate && endDate) {
                const start = new Date(startDate);
                const end = new Date(endDate);
                whereClause.createdAt = {
                    [Op.gte]: start,
                    [Op.lte]: end
                };
            }

            const status = is_active?.toLowerCase();
            let userWhere: any = {};
            if (status === APP_CONSTANTS.action.active || status === APP_CONSTANTS.action.inactive) {
                userWhere.is_active = status === APP_CONSTANTS.action.active;
            }

            const createUserInclude = (as: string, where: any) => ({
                model: User,
                as,
                attributes: [USER_EXTRA_FIELDS.ID, ADMIN_FIELDS.EMAIL, ADMIN_FIELDS.PHONE_NUMBER],
                where,
                required: true,
                include: [{
                    model: UserProfile,
                    as: PROFILE_FIELDS.OPTIONAL.PROFILE,
                    attributes: [PROFILE_FIELDS.MANDATORY.FIRST_NAME, PROFILE_FIELDS.MANDATORY.LAST_NAME, PROFILE_FIELDS.OPTIONAL.PROFILE_ID]
                }]
            });

            const result = await PaginationUtil.paginate(HelpSupportMaster, {
                page,
                limit: perpage,
                where: whereClause,
                include: [
                    createUserInclude(USER_ASSOCIATIONS.USER, userWhere)
                ],
                order: [[ADMIN_FIELDS.CREATED_AT, USER_EXTRA_FIELDS.DESC]],
            });

            return result;
        } catch (error: any) {
            console.error(APP_CONSTANTS.message.get_help_support_err, error);
            return {
                success: false,
                error: error.message || APP_CONSTANTS.message.get_help_support_err,
                data: null,
            };
        }
    };



  getDashboardList = async (startDate?: string, endDate?: string) => {
    try {
        // Date Filters
        let userDateFilter: any = {};

        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);

            userDateFilter = { created_at: { [Op.gte]: start, [Op.lte]: end } };
        }

        // Run all independent counts in parallel
        const [
            totalUsers,
            usersInDateRange,
            liked_profile,
            disliked_profile,
            totalBlocked,
            totalreportUser,
            chatChannelStats
        ] = await Promise.all([
            User.count(),
            User.count({ where: userDateFilter }),
            LikedProfile.count({ where: { status: APP_CONSTANTS.action.pending, ...userDateFilter } }),
            LikedProfile.count({ where: { status: APP_CONSTANTS.action.disliked, ...userDateFilter } }),
            BlockedUser.count({ where: userDateFilter }),
            ReportUser.count({ where: userDateFilter }),
            ChatHistory.findAll({
                attributes: [
                    [CHAT_HISTORY.CHANNAL_ID, CHAT_HISTORY.CHANNAL_ID],
                    [Sequelize.fn(CHAT_HISTORY.MAX, 
                        Sequelize.fn(CHAT_HISTORY.IF,
                            Sequelize.where(
                                Sequelize.fn(CHAT_HISTORY.CONCAT, Sequelize.col(CHAT_HISTORY.CHAT_MSG)),
                                Op.ne,
                                ''
                            ),
                            Sequelize.literal('1'),
                            Sequelize.literal('0')
                        )
                    ), CHAT_HISTORY.has_message]
                ],
                where: userDateFilter,
                group: [CHAT_HISTORY.CHANNAL_ID],
                raw: true,
                subQuery: false,
            }),
        ]);

        // Calculate channel statistics
        const totalChatUsers = chatChannelStats.length;
        const totalMatchedChats = chatChannelStats.filter((ch: any) => ch.has_message === 1).length;
        const matchedUsers = chatChannelStats.filter((ch: any) => ch.has_message === 0).length;

        // Response
        return {
            success: true,
            data: {
                totalUsers,
                usersInDateRange,
                matchedUsers,
                totalMatchedChats,
                totalChatUsers,
                totalBlocked,
                liked_profile,
                disliked_profile,
                totalreportUser,
                dateRange: startDate && endDate ? { startDate, endDate } : null,
            },
        };
    } catch (error: any) {
        console.error(APP_CONSTANTS.message.Failed_to_fetch_dashboard_data, error);
        return {
            success: false,
            error: error.message || APP_CONSTANTS.message.Failed_to_fetch_dashboard_data,
            data: null,
        };
    }
};


    getFilterList = async () => {
        try {
            const cities = await UserLocation.findAll({
                attributes: [PROFILE_FIELDS.MANDATORY.CITY],
                where: {
                    city: { [Op.ne]: null }
                },
                raw: true,
                subQuery: false,
                group: [PROFILE_FIELDS.MANDATORY.CITY],
                order: [[PROFILE_FIELDS.MANDATORY.CITY, PROFILE_FIELDS.MANDATORY.ASC]]
            });

            const states = await UserLocation.findAll({
                attributes: [PROFILE_FIELDS.MANDATORY.STATE],
                where: {
                    state: { [Op.ne]: null }
                },
                raw: true,
                subQuery: false,
                group: [PROFILE_FIELDS.MANDATORY.STATE],
                order: [[PROFILE_FIELDS.MANDATORY.STATE, PROFILE_FIELDS.MANDATORY.ASC]]
            });

            const cityList = cities.map((item: any) => item.city);
            const stateList = states.map((item: any) => item.state);

            return {
                status: true,
                responseCode: APP_CONSTANTS.code.status_success_code,
                message: APP_CONSTANTS.message.data_fetch,
                result: {
                    cities: cityList,
                    states: stateList,
                }
            };

        } catch (error: any) {
            console.error(APP_CONSTANTS.message.fetch_error, error);
            return {
                status: false,
                responseCode: APP_CONSTANTS.code.status_internal_server,
                message: error.message || APP_CONSTANTS.message.fetch_error,
                result: null
            };
        }
    };
    getNotificationList = async (
        page: number,
        perpage: number,
        search?: string,
        trigger_to?: string,
        startDate?: string,
        endDate?: string
    ) => {
        try {
            let whereClause: any = {};

            if (search) {
                whereClause[Op.or] = [
                    { notification_title: { [Op.like]: `%${search}%` } },
                    { notification_message: { [Op.like]: `%${search}%` } },
                    { trigger_to: { [Op.like]: `%${search}%` } }
                ];
            }

            if (trigger_to) {
                whereClause.trigger_to = trigger_to;
            }
            if (startDate && endDate) {
                const start = new Date(startDate);
                const end = new Date(endDate);
                whereClause.createdAt = {
                    [Op.gte]: start,
                    [Op.lte]: end
                };
            }

            const result = await PaginationUtil.paginate(AdminNotification, {
                page,
                limit: perpage,
                where: whereClause,
                order: [[ADMIN_FIELDS.CREATED_AT_CAMEL, USER_EXTRA_FIELDS.DESC]],
            });

            return result;
        } catch (error: any) {
            console.error(APP_CONSTANTS.message.notification_err, error);
            return {
                status: false,
                responseCode: APP_CONSTANTS.code.status_internal_server,
                message: error.message || APP_CONSTANTS.message.fetch_error,
                result: null,
            };
        }
    };
}