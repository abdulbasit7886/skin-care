-- CreateTable
CREATE TABLE "facilities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "contact_number" TEXT,
    "proprietor_1" TEXT,
    "proprietor_2" TEXT,
    "registration_number" TEXT,
    "email" TEXT,
    "website" TEXT,
    "tax_number" TEXT,
    "logo_url" TEXT,
    "role_permissions" JSONB,
    "role_landing" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "facilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "facility_id" TEXT,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "doctor_id" TEXT,
    "employee_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "failed_logins" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "reset_token_hash" TEXT,
    "reset_token_expires" TIMESTAMP(3),
    "password_changed_at" TIMESTAMP(3),
    "token_version" INTEGER NOT NULL DEFAULT 0,
    "last_login_at" TIMESTAMP(3),
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctors" (
    "id" TEXT NOT NULL,
    "facility_id" TEXT NOT NULL,
    "title" TEXT,
    "first_name" TEXT,
    "last_name" TEXT,
    "name" TEXT NOT NULL,
    "specialization" TEXT,
    "pmdc" TEXT,
    "cnic" TEXT,
    "sex" TEXT,
    "father_husband" TEXT,
    "mobile" TEXT,
    "email" TEXT,
    "address" TEXT,
    "place_of_posting" TEXT,
    "consultation_fee" DOUBLE PRECISION,
    "followup_fee" DOUBLE PRECISION,
    "color" TEXT,
    "is_admin" BOOLEAN NOT NULL DEFAULT false,
    "permissions" JSONB,
    "landing_page" TEXT,
    "show_on_website" BOOLEAN NOT NULL DEFAULT true,
    "photo_url" TEXT,
    "bio" TEXT,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "doctors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "facility_id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "designation" TEXT,
    "role" TEXT NOT NULL DEFAULT 'reception',
    "sex" TEXT,
    "father_husband" TEXT,
    "cnic" TEXT,
    "mobile" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT,
    "permissions" JSONB,
    "landing_page" TEXT,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" TEXT NOT NULL,
    "facility_id" TEXT NOT NULL,
    "mrn" TEXT,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "name" TEXT,
    "cnic" TEXT,
    "mobile" TEXT NOT NULL,
    "address" TEXT,
    "father_husband" TEXT,
    "age" TEXT,
    "sex" TEXT,
    "profession" TEXT,
    "referred_by" TEXT,
    "previous_diagnosis" TEXT,
    "chart_image_uri" TEXT,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "facility_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "patient_name" TEXT,
    "mrn" TEXT,
    "doctor_id" TEXT NOT NULL,
    "doctor_name" TEXT,
    "date" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "duration_minutes" INTEGER NOT NULL DEFAULT 15,
    "type" TEXT NOT NULL DEFAULT 'in_clinic',
    "status" TEXT NOT NULL DEFAULT 'booked',
    "reason" TEXT,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emrs" (
    "id" TEXT NOT NULL,
    "facility_id" TEXT NOT NULL,
    "appointment_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "patient_name" TEXT,
    "mrn" TEXT,
    "doctor_id" TEXT NOT NULL,
    "doctor_name" TEXT,
    "visit_date" TEXT,
    "chief_complaint" TEXT,
    "history_chief_complaint" TEXT,
    "past_history" TEXT,
    "allergies" TEXT,
    "labs_tests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "differential_diagnosis" TEXT,
    "diagnosis" TEXT,
    "treatment" TEXT,
    "prescription" TEXT,
    "services_offered" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "procedures_performed" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "advise" TEXT,
    "followup_date" TEXT,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "emrs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emr_addenda" (
    "id" TEXT NOT NULL,
    "facility_id" TEXT NOT NULL,
    "emr_id" TEXT NOT NULL,
    "emr_doctor_id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "doctor_name" TEXT,
    "text" TEXT NOT NULL,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "emr_addenda_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "facility_id" TEXT NOT NULL,
    "appointment_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "patient_name" TEXT,
    "mrn" TEXT,
    "doctor_id" TEXT NOT NULL,
    "doctor_name" TEXT,
    "emr_id" TEXT,
    "visit_type" TEXT NOT NULL DEFAULT 'consultation',
    "visit_date" TEXT,
    "visit_time" TEXT,
    "consultation_fee" DOUBLE PRECISION,
    "service_items" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "services_total" DOUBLE PRECISION,
    "procedure_items" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "procedures_total" DOUBLE PRECISION,
    "total" DOUBLE PRECISION,
    "discount_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tax_rate" DOUBLE PRECISION,
    "tax_amount" DOUBLE PRECISION,
    "amount_paid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "payment_mode" TEXT,
    "printed" BOOLEAN NOT NULL DEFAULT false,
    "printed_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'unpaid',
    "is_corrected" BOOLEAN NOT NULL DEFAULT false,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "corrected_at" TIMESTAMP(3),
    "corrected_by" TEXT,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "facility_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procedures" (
    "id" TEXT NOT NULL,
    "facility_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "procedures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_tests" (
    "id" TEXT NOT NULL,
    "facility_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "lab_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_rates" (
    "id" TEXT NOT NULL,
    "facility_id" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "effective_date" TEXT NOT NULL,
    "note" TEXT,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_date" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "tax_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "facility_id" TEXT,
    "entity" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "user_id" TEXT,
    "user_name" TEXT,
    "user_role" TEXT,
    "summary" TEXT,
    "changes" JSONB,
    "snapshot" JSONB,
    "ip" TEXT,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" TEXT NOT NULL,
    "facility_id" TEXT,
    "visibility" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "original_name" TEXT,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploaded_by" TEXT,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_messages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "ip" TEXT,
    "created_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_doctor_id_key" ON "users"("doctor_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_employee_id_key" ON "users"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_reset_token_hash_key" ON "users"("reset_token_hash");

-- CreateIndex
CREATE INDEX "users_facility_id_idx" ON "users"("facility_id");

-- CreateIndex
CREATE INDEX "doctors_facility_id_name_idx" ON "doctors"("facility_id", "name");

-- CreateIndex
CREATE INDEX "employees_facility_id_first_name_idx" ON "employees"("facility_id", "first_name");

-- CreateIndex
CREATE INDEX "patients_facility_id_name_idx" ON "patients"("facility_id", "name");

-- CreateIndex
CREATE INDEX "patients_facility_id_mrn_idx" ON "patients"("facility_id", "mrn");

-- CreateIndex
CREATE INDEX "patients_facility_id_mobile_idx" ON "patients"("facility_id", "mobile");

-- CreateIndex
CREATE INDEX "appointments_facility_id_date_idx" ON "appointments"("facility_id", "date");

-- CreateIndex
CREATE INDEX "appointments_facility_id_doctor_id_date_idx" ON "appointments"("facility_id", "doctor_id", "date");

-- CreateIndex
CREATE INDEX "appointments_facility_id_patient_id_idx" ON "appointments"("facility_id", "patient_id");

-- CreateIndex
CREATE INDEX "emrs_facility_id_appointment_id_idx" ON "emrs"("facility_id", "appointment_id");

-- CreateIndex
CREATE INDEX "emrs_facility_id_patient_id_idx" ON "emrs"("facility_id", "patient_id");

-- CreateIndex
CREATE INDEX "emrs_facility_id_doctor_id_idx" ON "emrs"("facility_id", "doctor_id");

-- CreateIndex
CREATE INDEX "emr_addenda_facility_id_emr_id_idx" ON "emr_addenda"("facility_id", "emr_id");

-- CreateIndex
CREATE INDEX "invoices_facility_id_appointment_id_idx" ON "invoices"("facility_id", "appointment_id");

-- CreateIndex
CREATE INDEX "invoices_facility_id_visit_date_idx" ON "invoices"("facility_id", "visit_date");

-- CreateIndex
CREATE INDEX "invoices_facility_id_patient_id_idx" ON "invoices"("facility_id", "patient_id");

-- CreateIndex
CREATE INDEX "services_facility_id_name_idx" ON "services"("facility_id", "name");

-- CreateIndex
CREATE INDEX "procedures_facility_id_name_idx" ON "procedures"("facility_id", "name");

-- CreateIndex
CREATE INDEX "lab_tests_facility_id_name_idx" ON "lab_tests"("facility_id", "name");

-- CreateIndex
CREATE INDEX "tax_rates_facility_id_effective_date_idx" ON "tax_rates"("facility_id", "effective_date");

-- CreateIndex
CREATE INDEX "audit_logs_facility_id_created_date_idx" ON "audit_logs"("facility_id", "created_date");

-- CreateIndex
CREATE INDEX "audit_logs_entity_record_id_idx" ON "audit_logs"("entity", "record_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_created_date_idx" ON "audit_logs"("action", "created_date");

-- CreateIndex
CREATE UNIQUE INDEX "files_storage_key_key" ON "files"("storage_key");

-- CreateIndex
CREATE INDEX "contact_messages_created_date_idx" ON "contact_messages"("created_date");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
