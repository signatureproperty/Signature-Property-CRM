
'use client';

export type UserRole = 'Admin' | 'Agent' | 'Video Recorder' | 'Super Admin';
export type PlanName = 'Basic' | 'Standard' | 'Premium';

export type User = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role: UserRole;
  avatar?: string;
  agency_id: string; // The ID of the agency admin user
  permissions?: Record<string, boolean>;
  stats?: {
      propertiesSold: number;
      activeBuyers: number;
      appointmentsToday: number;
  },
  status?: 'Pending' | 'Active'; // New status for invitations
  invitedAt?: any; // Timestamp for pending invites
  planName?: PlanName;
  planStartDate?: string;
  user_id?: string; // Actual Auth UID
};

export type BrandingConfig = {
  appName: string;
  appDescription: string;
  pwaIconUrl: string;
  updatedAt: string;
};

export type Tag = {
  id: string;
  name: string;
  color: string; // Hex or tailwind class
  agency_id: string;
  createdAt: string;
  listingType?: ListingType | 'All';
};


export type PropertyType = 'House' | 'Flat' | 'Farm House' | 'Penthouse' | 'Plot' | 'Residential Plot' | 'Commercial Plot' | 'Agricultural Land' | 'Industrial Land' | 'Office' | 'Shop' | 'Warehouse' | 'Factory' | 'Building' | 'Commercial Property' | 'Semi Commercial' | 'Residential Property' | 'Old House' | '';
export type SizeUnit = 'Marla' | 'SqFt' | 'Kanal' | 'Acre' | 'Maraba';
export type PriceUnit = 'Thousand' | 'Lacs' | 'Crore';
export type PropertyStatus = 'New' | 'Available' | 'Sold' | 'Rent Out' | 'Sold (External)';
export type ListingType = 'For Sale' | 'For Rent';
export type EditingStatus = 'In Editing' | 'Complete';
export type RecordingPaymentStatus = 'Unpaid' | 'Paid Online' | 'Pending Cash';

export type UploadedDocument = {
    name: string;
    url: string;
    uploadedAt: string;
    fileName: string; // Stored for deletion
};

export type Property = {
  id: string;
  serial_no: string;
  listing_type: ListingType;
  auto_title: string;
  country_code: string;
  owner_number: string;
  city: string;
  area: string;
  address: string;
  property_type: PropertyType;
  size_value: number;
  size_unit: SizeUnit;
  road_size_ft?: number;
  storey?: string;
  is_for_rent: boolean;
  meters?: {
    electricity: boolean;
    gas: boolean;
    water: boolean;
  };
  potential_rent_amount?: number;
  potential_rent_unit?: PriceUnit;
  front_ft?: number;
  length_ft?: number;
  demand_amount: number;
  demand_unit: 'Lacs' | 'Crore' | 'Thousand';
  documents?: string;
  message?: string; // General notes for any property type
  status: PropertyStatus;
  is_recorded: boolean;
  editing_status?: EditingStatus;
  recording_notes?: string; // New field for video recording feedback
  created_at: string;
  created_by: string; // user id
  agency_id: string;
  video_links?: {
    tiktok?: string;
    youtube?: string;
    instagram?: string;
    facebook?: string;
    other?: string;
  };
  is_deleted?: boolean;
  assignedTo?: string | string[] | null; // Properties can have multiple assignments
  // Sale details
  sold_price?: number;
  sold_price_unit?: PriceUnit;
  sale_date?: string;
  sold_externally_date?: string; // New field for external sales tracking
  sold_by_agent_id?: string;
  buyerId?: string | null;
  buyerName?: string | null;
  buyerSerialNo?: string | null;
  commission_from_buyer?: number;
  commission_from_buyer_unit?: PriceUnit;
  commission_from_seller?: number;
  commission_from_seller_unit?: PriceUnit;
  total_commission?: number;
  agent_commission_amount?: number;
  agent_commission_unit?: PriceUnit;
  agent_share_percentage?: number;

  // Rent out details
  rent_out_date?: string;
  rented_by_agent_id?: string;
  final_rent_amount?: number;
  final_rent_unit?: PriceUnit;
  rent_commission_from_tenant?: number;
  rent_commission_from_tenant_unit?: PriceUnit;
  rent_commission_from_owner?: number;
  rent_commission_from_owner_unit?: PriceUnit;
  rent_total_commission?: number;
  rent_agent_share?: number;
  rent_agent_share_unit?: PriceUnit;

  // Tenant Details
  tenant_name?: string;
  tenant_phone?: string;
  tenant_cnic?: string;
  tenant_family_members?: number;
  
  // Document Management
  uploaded_documents?: UploadedDocument[];
  
  // Recording Payment
  recording_payment_status?: RecordingPaymentStatus;
  recording_payment_amount?: number;
  recording_payment_date?: string;

  // Tags
  tags?: string[];
  
  // Remarks & Updates
  timeline_notes?: LeadNote[];
  last_remark_at?: string;
};

export type RecommendedProperty = Property & {
  matchScore: number;
  matchReasons: string[];
};


export type BuyerStatus =
  | 'New'
  | 'Interested'
  | 'Not Interested'
  | 'Follow Up'
  | 'Visited Property'
  | 'Deal Closed'
  | 'Deal Lost';

export type LeadNote = {
    id: string;
    text: string;
    authorId: string;
    authorName: string;
    authorRole: UserRole;
    timestamp: string;
    readBy?: string[]; // Track who has seen this remark
};

export type Buyer = {
    id: string;
    serial_no: string;
    listing_type: ListingType;
    name: string;
    country_code: string;
    phone: string;
    email?: string;
    status: BuyerStatus;
    is_investor?: boolean;
    city?: string;
    area_preference?: string;
    property_type_preference?: PropertyType;
    budget_min_amount?: number;
    budget_min_unit?: PriceUnit;
    budget_max_amount?: number;
    budget_max_unit?: PriceUnit;
    size_min_value?: number;
    size_min_unit?: SizeUnit;
    size_max_value?: number;
    size_max_unit?: SizeUnit;
    notes?: string;
    timeline_notes?: LeadNote[];
    last_remark_at?: string;
    created_at: string;
    created_by: string;
    agency_id: string;
    is_deleted?: boolean;
    last_follow_up_note?: string;
    assignedTo?: string | null; // Buyers have ONE specific assignment
    sharedProperties?: {
        propertyId: string;
        propertySerialNo: string;
        propertyTitle: string;
        sharedAt: string;
    }[];
    deal_lost_date?: string; // New field
    tags?: string[];
};

export type FollowUpStatus = 'Scheduled' | 'Completed';

export type FollowUp = {
    id: string;
    buyerId: string;
    buyerName: string;
    buyerPhone?: string;
    propertyInterest: string;
    lastContactDate: string;
    lastContactTime?: string;
    nextReminderDate: string;
    nextReminderTime: string;
    status: FollowUpStatus;
    notes: string;
    agency_id: string;
};

export type AppointmentStatus = 'Scheduled' | 'Completed' | 'Cancelled';
export type AppointmentContactType = 'Buyer' | 'Owner';


export type Appointment = {
    id: string;
    contactName: string;
    contactSerialNo?: string;
    contactType: AppointmentContactType;
    agentName: string;
    date: string;
    time: string;
    message: string;
    status: AppointmentStatus;
    notes?: string;
    agency_id: string;
}

export type Activity = {
    id: string;
    userName: string;
    userAvatar?: string;
    action: string;
    target: string;
    targetType: 'Property' | 'Buyer' | 'Appointment' | 'User' | 'FollowUp' | 'Invitation';
    details: { from: string; to: string } | null;
    timestamp: string;
    agency_id: string;
    assignedToId?: string | null;
    assignedToName?: string | null;
};

export type NotificationType = 'invitation' | 'appointment' | 'followup' | 'activity' | 'message';

export interface BaseNotification {
    id: string;
    type: NotificationType;
    title: string;
    description: string;
    timestamp: Date;
    isRead: boolean;
    isDeleted?: boolean;
}

export interface InvitationNotification extends BaseNotification {
    type: 'invitation';
    fromAgencyId: string;
    fromAgencyName: string;
    role: UserRole;
    email: string;
    memberDocId: string;
}

export interface AppointmentNotification extends BaseNotification {
    type: 'appointment';
    appointment: Appointment;
    reminderType: 'day' | 'hour' | 'minute';
}

export interface FollowUpNotification extends BaseNotification {
    type: 'followup';
    followUp: FollowUp;
    reminderType: 'day' | 'hour' | 'minute';
}

export interface ActivityNotification extends BaseNotification {
    type: 'activity';
    activity: Activity;
}

export interface MessageNotification extends BaseNotification {
    type: 'message';
    leadId: string;
    leadSerial: string;
    authorName: string;
    leadType: 'Buyer' | 'Property';
}

export type Notification = InvitationNotification | AppointmentNotification | FollowUpNotification | ActivityNotification | MessageNotification;

export type UpgradeRequest = {
    id: string;
    agencyId: string;
    agencyName: string;
    userId: string;
    userName: string;
    requestedPlan: PlanName;
    billingCycle: 'monthly' | 'yearly';
    amount: number;
    transactionId: string;
    receiptUrl: string;
    status: 'pending' | 'approved' | 'rejected';
    createdAt: any; // Firestore timestamp
    reviewedAt?: any;
    reviewerId?: string;
};

export type InboxMessageType = 'cannot_record' | 'payment_confirmation' | 'lead_update';

export interface InboxMessage {
    id: string;
    type: InboxMessageType;
    fromUserId: string;
    fromUserName: string;
    message: string;
    propertyId?: string;
    propertySerial?: string;
    buyerId?: string;
    buyerSerial?: string;
    isRead: boolean;
    createdAt: string;
    agency_id: string;
};

export type Agency = {
    id: string;
    agencyName: string;
    ownerId: string;
    name: string;
    createdAt: any;
    avatar?: string;
    planName: PlanName;
    phone?: string;
    planStartDate?: any;
};
