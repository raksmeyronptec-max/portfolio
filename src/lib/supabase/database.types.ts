export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_roles: {
        Row: {
          created_at: string
          granted_at: string
          granted_by: string | null
          note: string | null
          revoked_at: string | null
          role: Database["public"]["Enums"]["admin_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_at?: string
          granted_by?: string | null
          note?: string | null
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["admin_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          granted_at?: string
          granted_by?: string | null
          note?: string | null
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["admin_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          browser_name: string | null
          country_code: string | null
          device_type: string | null
          entity_id: string | null
          entity_slug: string | null
          entity_type: string | null
          event_name: string
          id: number
          locale: Database["public"]["Enums"]["content_locale"] | null
          occurred_at: string
          os_name: string | null
          path: string | null
          properties: Json
          referrer_host: string | null
          visitor_hash: string | null
        }
        Insert: {
          browser_name?: string | null
          country_code?: string | null
          device_type?: string | null
          entity_id?: string | null
          entity_slug?: string | null
          entity_type?: string | null
          event_name: string
          id?: never
          locale?: Database["public"]["Enums"]["content_locale"] | null
          occurred_at?: string
          os_name?: string | null
          path?: string | null
          properties?: Json
          referrer_host?: string | null
          visitor_hash?: string | null
        }
        Update: {
          browser_name?: string | null
          country_code?: string | null
          device_type?: string | null
          entity_id?: string | null
          entity_slug?: string | null
          entity_type?: string | null
          event_name?: string
          id?: never
          locale?: Database["public"]["Enums"]["content_locale"] | null
          occurred_at?: string
          os_name?: string | null
          path?: string | null
          properties?: Json
          referrer_host?: string | null
          visitor_hash?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          actor_role: Database["public"]["Enums"]["admin_role"] | null
          changes: Json
          entity_id: string | null
          entity_label: string | null
          entity_type: string | null
          id: number
          ip_hash: string | null
          occurred_at: string
          summary: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["admin_role"] | null
          changes?: Json
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string | null
          id?: never
          ip_hash?: string | null
          occurred_at?: string
          summary?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["admin_role"] | null
          changes?: Json
          entity_id?: string | null
          entity_label?: string | null
          entity_type?: string | null
          id?: never
          ip_hash?: string | null
          occurred_at?: string
          summary?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      certificate_categories: {
        Row: {
          created_at: string
          description_en: string | null
          description_km: string | null
          icon: string | null
          id: string
          name_en: string
          name_km: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description_en?: string | null
          description_km?: string | null
          icon?: string | null
          id?: string
          name_en: string
          name_km?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description_en?: string | null
          description_km?: string | null
          icon?: string | null
          id?: string
          name_en?: string
          name_km?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      certificate_project_links: {
        Row: {
          certificate_id: string
          project_id: string
        }
        Insert: {
          certificate_id: string
          project_id: string
        }
        Update: {
          certificate_id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificate_project_links_certificate_id_fkey"
            columns: ["certificate_id"]
            isOneToOne: false
            referencedRelation: "certificates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificate_project_links_certificate_id_fkey"
            columns: ["certificate_id"]
            isOneToOne: false
            referencedRelation: "public_certificates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificate_project_links_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      certificate_skills: {
        Row: {
          certificate_id: string
          id: string
          label_en: string
          label_km: string | null
          sort_order: number
        }
        Insert: {
          certificate_id: string
          id?: string
          label_en: string
          label_km?: string | null
          sort_order?: number
        }
        Update: {
          certificate_id?: string
          id?: string
          label_en?: string
          label_km?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "certificate_skills_certificate_id_fkey"
            columns: ["certificate_id"]
            isOneToOne: false
            referencedRelation: "certificates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificate_skills_certificate_id_fkey"
            columns: ["certificate_id"]
            isOneToOne: false
            referencedRelation: "public_certificates"
            referencedColumns: ["id"]
          },
        ]
      }
      certificate_translations: {
        Row: {
          certificate_id: string
          created_at: string
          description: string | null
          id: string
          image_summary: string | null
          locale: Database["public"]["Enums"]["content_locale"]
          seo_description: string | null
          seo_title: string | null
          title: string
          translation_state: Database["public"]["Enums"]["translation_state"]
          updated_at: string
        }
        Insert: {
          certificate_id: string
          created_at?: string
          description?: string | null
          id?: string
          image_summary?: string | null
          locale: Database["public"]["Enums"]["content_locale"]
          seo_description?: string | null
          seo_title?: string | null
          title: string
          translation_state?: Database["public"]["Enums"]["translation_state"]
          updated_at?: string
        }
        Update: {
          certificate_id?: string
          created_at?: string
          description?: string | null
          id?: string
          image_summary?: string | null
          locale?: Database["public"]["Enums"]["content_locale"]
          seo_description?: string | null
          seo_title?: string | null
          title?: string
          translation_state?: Database["public"]["Enums"]["translation_state"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificate_translations_certificate_id_fkey"
            columns: ["certificate_id"]
            isOneToOne: false
            referencedRelation: "certificates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificate_translations_certificate_id_fkey"
            columns: ["certificate_id"]
            isOneToOne: false
            referencedRelation: "public_certificates"
            referencedColumns: ["id"]
          },
        ]
      }
      certificates: {
        Row: {
          allow_public_download: boolean
          category_id: string | null
          contains_sensitive_data: boolean
          created_at: string
          created_by: string | null
          credential_id: string | null
          credential_status: Database["public"]["Enums"]["credential_status"]
          deleted_at: string | null
          expires_on: string | null
          featured: boolean
          id: string
          internal_ref: string | null
          issued_on: string | null
          issuer_en: string
          issuer_km: string | null
          issuer_url: string | null
          needs_review: boolean
          og_image_media_id: string | null
          original_media_id: string | null
          preview_media_id: string | null
          privacy_review_note: string | null
          privacy_reviewed_at: string | null
          privacy_reviewed_by: string | null
          published_at: string | null
          review_note: string | null
          slug: string
          sort_order: number
          status: Database["public"]["Enums"]["publication_status"]
          updated_at: string
          updated_by: string | null
          verification_url: string | null
        }
        Insert: {
          allow_public_download?: boolean
          category_id?: string | null
          contains_sensitive_data?: boolean
          created_at?: string
          created_by?: string | null
          credential_id?: string | null
          credential_status?: Database["public"]["Enums"]["credential_status"]
          deleted_at?: string | null
          expires_on?: string | null
          featured?: boolean
          id?: string
          internal_ref?: string | null
          issued_on?: string | null
          issuer_en: string
          issuer_km?: string | null
          issuer_url?: string | null
          needs_review?: boolean
          og_image_media_id?: string | null
          original_media_id?: string | null
          preview_media_id?: string | null
          privacy_review_note?: string | null
          privacy_reviewed_at?: string | null
          privacy_reviewed_by?: string | null
          published_at?: string | null
          review_note?: string | null
          slug: string
          sort_order?: number
          status?: Database["public"]["Enums"]["publication_status"]
          updated_at?: string
          updated_by?: string | null
          verification_url?: string | null
        }
        Update: {
          allow_public_download?: boolean
          category_id?: string | null
          contains_sensitive_data?: boolean
          created_at?: string
          created_by?: string | null
          credential_id?: string | null
          credential_status?: Database["public"]["Enums"]["credential_status"]
          deleted_at?: string | null
          expires_on?: string | null
          featured?: boolean
          id?: string
          internal_ref?: string | null
          issued_on?: string | null
          issuer_en?: string
          issuer_km?: string | null
          issuer_url?: string | null
          needs_review?: boolean
          og_image_media_id?: string | null
          original_media_id?: string | null
          preview_media_id?: string | null
          privacy_review_note?: string | null
          privacy_reviewed_at?: string | null
          privacy_reviewed_by?: string | null
          published_at?: string | null
          review_note?: string | null
          slug?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["publication_status"]
          updated_at?: string
          updated_by?: string | null
          verification_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certificates_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "certificate_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_og_image_media_id_fkey"
            columns: ["og_image_media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_original_media_id_fkey"
            columns: ["original_media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_preview_media_id_fkey"
            columns: ["preview_media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_message_notes: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          message_id: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          message_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          message_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_message_notes_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "contact_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          consent_given: boolean
          created_at: string
          deleted_at: string | null
          email: string
          id: string
          ip_hash: string | null
          is_starred: boolean
          locale: Database["public"]["Enums"]["content_locale"]
          message: string
          name: string
          notification_error: string | null
          notification_sent: boolean
          organization: string | null
          preferred_contact: string | null
          project_type: string | null
          read_at: string | null
          referer: string | null
          replied_at: string | null
          spam_score: number
          state: Database["public"]["Enums"]["message_state"]
          subject: string | null
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          consent_given?: boolean
          created_at?: string
          deleted_at?: string | null
          email: string
          id?: string
          ip_hash?: string | null
          is_starred?: boolean
          locale?: Database["public"]["Enums"]["content_locale"]
          message: string
          name: string
          notification_error?: string | null
          notification_sent?: boolean
          organization?: string | null
          preferred_contact?: string | null
          project_type?: string | null
          read_at?: string | null
          referer?: string | null
          replied_at?: string | null
          spam_score?: number
          state?: Database["public"]["Enums"]["message_state"]
          subject?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          consent_given?: boolean
          created_at?: string
          deleted_at?: string | null
          email?: string
          id?: string
          ip_hash?: string | null
          is_starred?: boolean
          locale?: Database["public"]["Enums"]["content_locale"]
          message?: string
          name?: string
          notification_error?: string | null
          notification_sent?: boolean
          organization?: string | null
          preferred_contact?: string | null
          project_type?: string | null
          read_at?: string | null
          referer?: string | null
          replied_at?: string | null
          spam_score?: number
          state?: Database["public"]["Enums"]["message_state"]
          subject?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      content_revisions: {
        Row: {
          author_id: string | null
          change_summary: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: number
          revision_no: number
          snapshot: Json
          status_at_revision:
            | Database["public"]["Enums"]["publication_status"]
            | null
        }
        Insert: {
          author_id?: string | null
          change_summary?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: never
          revision_no: number
          snapshot: Json
          status_at_revision?:
            | Database["public"]["Enums"]["publication_status"]
            | null
        }
        Update: {
          author_id?: string | null
          change_summary?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: never
          revision_no?: number
          snapshot?: Json
          status_at_revision?:
            | Database["public"]["Enums"]["publication_status"]
            | null
        }
        Relationships: []
      }
      download_events: {
        Row: {
          id: number
          locale: Database["public"]["Enums"]["content_locale"] | null
          occurred_at: string
          resource_id: string | null
          resource_label: string | null
          resource_type: string
          visitor_hash: string | null
        }
        Insert: {
          id?: never
          locale?: Database["public"]["Enums"]["content_locale"] | null
          occurred_at?: string
          resource_id?: string | null
          resource_label?: string | null
          resource_type: string
          visitor_hash?: string | null
        }
        Update: {
          id?: never
          locale?: Database["public"]["Enums"]["content_locale"] | null
          occurred_at?: string
          resource_id?: string | null
          resource_label?: string | null
          resource_type?: string
          visitor_hash?: string | null
        }
        Relationships: []
      }
      education: {
        Row: {
          created_at: string
          deleted_at: string | null
          ended_on: string | null
          grade_scale: string | null
          grade_source_note: string | null
          grade_value: string | null
          id: string
          institution_url: string | null
          is_current: boolean
          kind: string
          needs_review: boolean
          period_label_en: string | null
          period_label_km: string | null
          published_at: string | null
          review_note: string | null
          schedule_label_en: string | null
          schedule_label_km: string | null
          slug: string
          sort_order: number
          started_on: string | null
          status: Database["public"]["Enums"]["publication_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          ended_on?: string | null
          grade_scale?: string | null
          grade_source_note?: string | null
          grade_value?: string | null
          id?: string
          institution_url?: string | null
          is_current?: boolean
          kind?: string
          needs_review?: boolean
          period_label_en?: string | null
          period_label_km?: string | null
          published_at?: string | null
          review_note?: string | null
          schedule_label_en?: string | null
          schedule_label_km?: string | null
          slug: string
          sort_order?: number
          started_on?: string | null
          status?: Database["public"]["Enums"]["publication_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          ended_on?: string | null
          grade_scale?: string | null
          grade_source_note?: string | null
          grade_value?: string | null
          id?: string
          institution_url?: string | null
          is_current?: boolean
          kind?: string
          needs_review?: boolean
          period_label_en?: string | null
          period_label_km?: string | null
          published_at?: string | null
          review_note?: string | null
          schedule_label_en?: string | null
          schedule_label_km?: string | null
          slug?: string
          sort_order?: number
          started_on?: string | null
          status?: Database["public"]["Enums"]["publication_status"]
          updated_at?: string
        }
        Relationships: []
      }
      education_translations: {
        Row: {
          achievements: string | null
          created_at: string
          description: string | null
          education_id: string
          field_of_study: string | null
          id: string
          institution: string
          locale: Database["public"]["Enums"]["content_locale"]
          qualification: string | null
          translation_state: Database["public"]["Enums"]["translation_state"]
          updated_at: string
        }
        Insert: {
          achievements?: string | null
          created_at?: string
          description?: string | null
          education_id: string
          field_of_study?: string | null
          id?: string
          institution: string
          locale: Database["public"]["Enums"]["content_locale"]
          qualification?: string | null
          translation_state?: Database["public"]["Enums"]["translation_state"]
          updated_at?: string
        }
        Update: {
          achievements?: string | null
          created_at?: string
          description?: string | null
          education_id?: string
          field_of_study?: string | null
          id?: string
          institution?: string
          locale?: Database["public"]["Enums"]["content_locale"]
          qualification?: string | null
          translation_state?: Database["public"]["Enums"]["translation_state"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "education_translations_education_id_fkey"
            columns: ["education_id"]
            isOneToOne: false
            referencedRelation: "education"
            referencedColumns: ["id"]
          },
        ]
      }
      experience_tags: {
        Row: {
          experience_id: string
          id: string
          label_en: string
          label_km: string | null
          sort_order: number
        }
        Insert: {
          experience_id: string
          id?: string
          label_en: string
          label_km?: string | null
          sort_order?: number
        }
        Update: {
          experience_id?: string
          id?: string
          label_en?: string
          label_km?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "experience_tags_experience_id_fkey"
            columns: ["experience_id"]
            isOneToOne: false
            referencedRelation: "experiences"
            referencedColumns: ["id"]
          },
        ]
      }
      experience_translations: {
        Row: {
          achievements: string | null
          created_at: string
          description: string | null
          experience_id: string
          id: string
          locale: Database["public"]["Enums"]["content_locale"]
          organization: string
          role_title: string
          summary: string | null
          translation_state: Database["public"]["Enums"]["translation_state"]
          updated_at: string
        }
        Insert: {
          achievements?: string | null
          created_at?: string
          description?: string | null
          experience_id: string
          id?: string
          locale: Database["public"]["Enums"]["content_locale"]
          organization: string
          role_title: string
          summary?: string | null
          translation_state?: Database["public"]["Enums"]["translation_state"]
          updated_at?: string
        }
        Update: {
          achievements?: string | null
          created_at?: string
          description?: string | null
          experience_id?: string
          id?: string
          locale?: Database["public"]["Enums"]["content_locale"]
          organization?: string
          role_title?: string
          summary?: string | null
          translation_state?: Database["public"]["Enums"]["translation_state"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "experience_translations_experience_id_fkey"
            columns: ["experience_id"]
            isOneToOne: false
            referencedRelation: "experiences"
            referencedColumns: ["id"]
          },
        ]
      }
      experiences: {
        Row: {
          created_at: string
          deleted_at: string | null
          employment_type: string | null
          ended_on: string | null
          id: string
          is_current: boolean
          kind: string
          location_en: string | null
          location_km: string | null
          needs_review: boolean
          organization_url: string | null
          period_label_en: string | null
          period_label_km: string | null
          published_at: string | null
          review_note: string | null
          slug: string
          sort_order: number
          started_on: string | null
          status: Database["public"]["Enums"]["publication_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          employment_type?: string | null
          ended_on?: string | null
          id?: string
          is_current?: boolean
          kind?: string
          location_en?: string | null
          location_km?: string | null
          needs_review?: boolean
          organization_url?: string | null
          period_label_en?: string | null
          period_label_km?: string | null
          published_at?: string | null
          review_note?: string | null
          slug: string
          sort_order?: number
          started_on?: string | null
          status?: Database["public"]["Enums"]["publication_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          employment_type?: string | null
          ended_on?: string | null
          id?: string
          is_current?: boolean
          kind?: string
          location_en?: string | null
          location_km?: string | null
          needs_review?: boolean
          organization_url?: string | null
          period_label_en?: string | null
          period_label_km?: string | null
          published_at?: string | null
          review_note?: string | null
          slug?: string
          sort_order?: number
          started_on?: string | null
          status?: Database["public"]["Enums"]["publication_status"]
          updated_at?: string
        }
        Relationships: []
      }
      languages: {
        Row: {
          cefr_level: string | null
          code: string
          created_at: string
          id: string
          is_native: boolean
          is_published: boolean
          name_en: string
          name_km: string | null
          proficiency_label_en: string
          proficiency_label_km: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          cefr_level?: string | null
          code: string
          created_at?: string
          id?: string
          is_native?: boolean
          is_published?: boolean
          name_en: string
          name_km?: string | null
          proficiency_label_en: string
          proficiency_label_km?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          cefr_level?: string | null
          code?: string
          created_at?: string
          id?: string
          is_native?: boolean
          is_published?: boolean
          name_en?: string
          name_km?: string | null
          proficiency_label_en?: string
          proficiency_label_km?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      media_assets: {
        Row: {
          alt_text_en: string | null
          alt_text_km: string | null
          blur_data_url: string | null
          bucket_id: string
          caption_en: string | null
          caption_km: string | null
          card_path: string | null
          checksum_sha256: string | null
          created_at: string
          credit: string | null
          deleted_at: string | null
          file_size_bytes: number
          height: number | null
          id: string
          kind: Database["public"]["Enums"]["media_kind"]
          mime_type: string
          original_filename: string
          preview_path: string | null
          requires_privacy_review: boolean
          storage_path: string
          storage_provider: string
          thumbnail_path: string | null
          updated_at: string
          uploaded_by: string | null
          visibility: Database["public"]["Enums"]["file_visibility"]
          width: number | null
        }
        Insert: {
          alt_text_en?: string | null
          alt_text_km?: string | null
          blur_data_url?: string | null
          bucket_id: string
          caption_en?: string | null
          caption_km?: string | null
          card_path?: string | null
          checksum_sha256?: string | null
          created_at?: string
          credit?: string | null
          deleted_at?: string | null
          file_size_bytes: number
          height?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["media_kind"]
          mime_type: string
          original_filename: string
          preview_path?: string | null
          requires_privacy_review?: boolean
          storage_path: string
          storage_provider?: string
          thumbnail_path?: string | null
          updated_at?: string
          uploaded_by?: string | null
          visibility?: Database["public"]["Enums"]["file_visibility"]
          width?: number | null
        }
        Update: {
          alt_text_en?: string | null
          alt_text_km?: string | null
          blur_data_url?: string | null
          bucket_id?: string
          caption_en?: string | null
          caption_km?: string | null
          card_path?: string | null
          checksum_sha256?: string | null
          created_at?: string
          credit?: string | null
          deleted_at?: string | null
          file_size_bytes?: number
          height?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["media_kind"]
          mime_type?: string
          original_filename?: string
          preview_path?: string | null
          requires_privacy_review?: boolean
          storage_path?: string
          storage_provider?: string
          thumbnail_path?: string | null
          updated_at?: string
          uploaded_by?: string | null
          visibility?: Database["public"]["Enums"]["file_visibility"]
          width?: number | null
        }
        Relationships: []
      }
      outbound_clicks: {
        Row: {
          context: string
          destination_host: string | null
          destination_url: string
          entity_id: string | null
          entity_type: string | null
          id: number
          locale: Database["public"]["Enums"]["content_locale"] | null
          occurred_at: string
          visitor_hash: string | null
        }
        Insert: {
          context?: string
          destination_host?: string | null
          destination_url: string
          entity_id?: string | null
          entity_type?: string | null
          id?: never
          locale?: Database["public"]["Enums"]["content_locale"] | null
          occurred_at?: string
          visitor_hash?: string | null
        }
        Update: {
          context?: string
          destination_host?: string | null
          destination_url?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: never
          locale?: Database["public"]["Enums"]["content_locale"] | null
          occurred_at?: string
          visitor_hash?: string | null
        }
        Relationships: []
      }
      page_views: {
        Row: {
          device_type: string | null
          entity_id: string | null
          entity_type: string | null
          id: number
          locale: Database["public"]["Enums"]["content_locale"]
          occurred_at: string
          path: string
          referrer_host: string | null
          visitor_hash: string | null
        }
        Insert: {
          device_type?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: never
          locale?: Database["public"]["Enums"]["content_locale"]
          occurred_at?: string
          path: string
          referrer_host?: string | null
          visitor_hash?: string | null
        }
        Update: {
          device_type?: string | null
          entity_id?: string | null
          entity_type?: string | null
          id?: never
          locale?: Database["public"]["Enums"]["content_locale"]
          occurred_at?: string
          path?: string
          referrer_host?: string | null
          visitor_hash?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_media_id: string | null
          created_at: string
          display_name: string | null
          email: string
          id: string
          is_site_owner: boolean
          last_login_at: string | null
          public_avatar_url: string | null
          public_bio_en: string | null
          public_bio_km: string | null
          public_headline_en: string | null
          public_headline_km: string | null
          public_location: string | null
          updated_at: string
        }
        Insert: {
          avatar_media_id?: string | null
          created_at?: string
          display_name?: string | null
          email: string
          id: string
          is_site_owner?: boolean
          last_login_at?: string | null
          public_avatar_url?: string | null
          public_bio_en?: string | null
          public_bio_km?: string | null
          public_headline_en?: string | null
          public_headline_km?: string | null
          public_location?: string | null
          updated_at?: string
        }
        Update: {
          avatar_media_id?: string | null
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          is_site_owner?: boolean
          last_login_at?: string | null
          public_avatar_url?: string | null
          public_bio_en?: string | null
          public_bio_km?: string | null
          public_headline_en?: string | null
          public_headline_km?: string | null
          public_location?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_avatar_media_fk"
            columns: ["avatar_media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      project_categories: {
        Row: {
          created_at: string
          description_en: string | null
          description_km: string | null
          id: string
          name_en: string
          name_km: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description_en?: string | null
          description_km?: string | null
          id?: string
          name_en: string
          name_km?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description_en?: string | null
          description_km?: string | null
          id?: string
          name_en?: string
          name_km?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      project_category_links: {
        Row: {
          category_id: string
          project_id: string
        }
        Insert: {
          category_id: string
          project_id: string
        }
        Update: {
          category_id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_category_links_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "project_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_category_links_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_features: {
        Row: {
          created_at: string
          description_en: string | null
          description_km: string | null
          icon: string | null
          id: string
          project_id: string
          sort_order: number
          title_en: string
          title_km: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description_en?: string | null
          description_km?: string | null
          icon?: string | null
          id?: string
          project_id: string
          sort_order?: number
          title_en: string
          title_km?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description_en?: string | null
          description_km?: string | null
          icon?: string | null
          id?: string
          project_id?: string
          sort_order?: number
          title_en?: string
          title_km?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_features_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_media: {
        Row: {
          caption_en: string | null
          caption_km: string | null
          created_at: string
          id: string
          media_id: string
          pair_key: string | null
          project_id: string
          sort_order: number
          variant: string
        }
        Insert: {
          caption_en?: string | null
          caption_km?: string | null
          created_at?: string
          id?: string
          media_id: string
          pair_key?: string | null
          project_id: string
          sort_order?: number
          variant?: string
        }
        Update: {
          caption_en?: string | null
          caption_km?: string | null
          created_at?: string
          id?: string
          media_id?: string
          pair_key?: string | null
          project_id?: string
          sort_order?: number
          variant?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_media_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_media_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_metrics: {
        Row: {
          created_at: string
          id: string
          is_verified: boolean
          label_en: string
          label_km: string | null
          measured_at: string | null
          metric_type: string
          project_id: string
          sort_order: number
          source_note: string | null
          unit: string | null
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_verified?: boolean
          label_en: string
          label_km?: string | null
          measured_at?: string | null
          metric_type?: string
          project_id: string
          sort_order?: number
          source_note?: string | null
          unit?: string | null
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          is_verified?: boolean
          label_en?: string
          label_km?: string | null
          measured_at?: string | null
          metric_type?: string
          project_id?: string
          sort_order?: number
          source_note?: string | null
          unit?: string | null
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_metrics_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_technologies: {
        Row: {
          project_id: string
          sort_order: number
          technology_id: string
        }
        Insert: {
          project_id: string
          sort_order?: number
          technology_id: string
        }
        Update: {
          project_id?: string
          sort_order?: number
          technology_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_technologies_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_technologies_technology_id_fkey"
            columns: ["technology_id"]
            isOneToOne: false
            referencedRelation: "technologies"
            referencedColumns: ["id"]
          },
        ]
      }
      project_translations: {
        Row: {
          accessibility_notes: string | null
          architecture: string | null
          body_blocks: Json
          challenges: string | null
          constraints: string | null
          created_at: string
          database_decisions: string | null
          goals: string | null
          id: string
          key_features: string | null
          lessons: string | null
          locale: Database["public"]["Enums"]["content_locale"]
          my_role: string | null
          next_steps: string | null
          overview: string | null
          performance_notes: string | null
          problem: string | null
          project_id: string
          research: string | null
          responsibilities: string | null
          results: string | null
          security_notes: string | null
          seo_description: string | null
          seo_notes: string | null
          seo_title: string | null
          solution: string | null
          summary: string | null
          target_users: string | null
          title: string
          translation_state: Database["public"]["Enums"]["translation_state"]
          updated_at: string
          ux_decisions: string | null
        }
        Insert: {
          accessibility_notes?: string | null
          architecture?: string | null
          body_blocks?: Json
          challenges?: string | null
          constraints?: string | null
          created_at?: string
          database_decisions?: string | null
          goals?: string | null
          id?: string
          key_features?: string | null
          lessons?: string | null
          locale: Database["public"]["Enums"]["content_locale"]
          my_role?: string | null
          next_steps?: string | null
          overview?: string | null
          performance_notes?: string | null
          problem?: string | null
          project_id: string
          research?: string | null
          responsibilities?: string | null
          results?: string | null
          security_notes?: string | null
          seo_description?: string | null
          seo_notes?: string | null
          seo_title?: string | null
          solution?: string | null
          summary?: string | null
          target_users?: string | null
          title: string
          translation_state?: Database["public"]["Enums"]["translation_state"]
          updated_at?: string
          ux_decisions?: string | null
        }
        Update: {
          accessibility_notes?: string | null
          architecture?: string | null
          body_blocks?: Json
          challenges?: string | null
          constraints?: string | null
          created_at?: string
          database_decisions?: string | null
          goals?: string | null
          id?: string
          key_features?: string | null
          lessons?: string | null
          locale?: Database["public"]["Enums"]["content_locale"]
          my_role?: string | null
          next_steps?: string | null
          overview?: string | null
          performance_notes?: string | null
          problem?: string | null
          project_id?: string
          research?: string | null
          responsibilities?: string | null
          results?: string | null
          security_notes?: string | null
          seo_description?: string | null
          seo_notes?: string | null
          seo_title?: string | null
          solution?: string | null
          summary?: string | null
          target_users?: string | null
          title?: string
          translation_state?: Database["public"]["Enums"]["translation_state"]
          updated_at?: string
          ux_decisions?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_translations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          completed_at: string | null
          cover_media_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          demo_video_url: string | null
          duration_label_en: string | null
          duration_label_km: string | null
          featured: boolean
          id: string
          live_url: string | null
          needs_review: boolean
          og_image_media_id: string | null
          organization_en: string | null
          organization_km: string | null
          period_label_en: string | null
          period_label_km: string | null
          project_status: Database["public"]["Enums"]["project_status"]
          published_at: string | null
          repository_url: string | null
          review_note: string | null
          role_en: string | null
          role_km: string | null
          slug: string
          sort_order: number
          started_at: string | null
          status: Database["public"]["Enums"]["publication_status"]
          team_size: number | null
          updated_at: string
          updated_by: string | null
          year_label: string | null
        }
        Insert: {
          completed_at?: string | null
          cover_media_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          demo_video_url?: string | null
          duration_label_en?: string | null
          duration_label_km?: string | null
          featured?: boolean
          id?: string
          live_url?: string | null
          needs_review?: boolean
          og_image_media_id?: string | null
          organization_en?: string | null
          organization_km?: string | null
          period_label_en?: string | null
          period_label_km?: string | null
          project_status?: Database["public"]["Enums"]["project_status"]
          published_at?: string | null
          repository_url?: string | null
          review_note?: string | null
          role_en?: string | null
          role_km?: string | null
          slug: string
          sort_order?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["publication_status"]
          team_size?: number | null
          updated_at?: string
          updated_by?: string | null
          year_label?: string | null
        }
        Update: {
          completed_at?: string | null
          cover_media_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          demo_video_url?: string | null
          duration_label_en?: string | null
          duration_label_km?: string | null
          featured?: boolean
          id?: string
          live_url?: string | null
          needs_review?: boolean
          og_image_media_id?: string | null
          organization_en?: string | null
          organization_km?: string | null
          period_label_en?: string | null
          period_label_km?: string | null
          project_status?: Database["public"]["Enums"]["project_status"]
          published_at?: string | null
          repository_url?: string | null
          review_note?: string | null
          role_en?: string | null
          role_km?: string | null
          slug?: string
          sort_order?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["publication_status"]
          team_size?: number | null
          updated_at?: string
          updated_by?: string | null
          year_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_cover_media_id_fkey"
            columns: ["cover_media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_og_image_media_id_fkey"
            columns: ["og_image_media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      resume_versions: {
        Row: {
          created_at: string
          deleted_at: string | null
          download_count: number
          effective_from: string
          id: string
          is_active: boolean
          is_archived: boolean
          locale: Database["public"]["Enums"]["content_locale"]
          media_id: string
          notes: string | null
          updated_at: string
          version_label: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          download_count?: number
          effective_from?: string
          id?: string
          is_active?: boolean
          is_archived?: boolean
          locale?: Database["public"]["Enums"]["content_locale"]
          media_id: string
          notes?: string | null
          updated_at?: string
          version_label: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          download_count?: number
          effective_from?: string
          id?: string
          is_active?: boolean
          is_archived?: boolean
          locale?: Database["public"]["Enums"]["content_locale"]
          media_id?: string
          notes?: string | null
          updated_at?: string
          version_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "resume_versions_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_overrides: {
        Row: {
          canonical_url: string | null
          created_at: string
          description: string | null
          id: string
          include_in_sitemap: boolean
          is_indexable: boolean
          locale: Database["public"]["Enums"]["content_locale"]
          og_image_media_id: string | null
          route_key: string
          sitemap_priority: number | null
          title: string | null
          updated_at: string
        }
        Insert: {
          canonical_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          include_in_sitemap?: boolean
          is_indexable?: boolean
          locale: Database["public"]["Enums"]["content_locale"]
          og_image_media_id?: string | null
          route_key: string
          sitemap_priority?: number | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          canonical_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          include_in_sitemap?: boolean
          is_indexable?: boolean
          locale?: Database["public"]["Enums"]["content_locale"]
          og_image_media_id?: string | null
          route_key?: string
          sitemap_priority?: number | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_overrides_og_image_media_id_fkey"
            columns: ["og_image_media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          analytics_enabled: boolean
          availability_status_en: string | null
          availability_status_km: string | null
          chat_widget_enabled: boolean
          contact_email: string | null
          contact_form_enabled: boolean
          created_at: string
          default_locale: Database["public"]["Enums"]["content_locale"]
          default_og_image_media_id: string | null
          facebook_url: string | null
          github_url: string | null
          google_site_verification: string | null
          hero_headline_en: string | null
          hero_headline_km: string | null
          hero_subheadline_en: string | null
          hero_subheadline_km: string | null
          id: boolean
          is_available_for_work: boolean
          linkedin_url: string | null
          location_en: string | null
          location_km: string | null
          positioning_en: string | null
          positioning_km: string | null
          site_name_en: string
          site_name_km: string
          tagline_en: string | null
          tagline_km: string | null
          telegram_handle: string | null
          updated_at: string
        }
        Insert: {
          analytics_enabled?: boolean
          availability_status_en?: string | null
          availability_status_km?: string | null
          chat_widget_enabled?: boolean
          contact_email?: string | null
          contact_form_enabled?: boolean
          created_at?: string
          default_locale?: Database["public"]["Enums"]["content_locale"]
          default_og_image_media_id?: string | null
          facebook_url?: string | null
          github_url?: string | null
          google_site_verification?: string | null
          hero_headline_en?: string | null
          hero_headline_km?: string | null
          hero_subheadline_en?: string | null
          hero_subheadline_km?: string | null
          id?: boolean
          is_available_for_work?: boolean
          linkedin_url?: string | null
          location_en?: string | null
          location_km?: string | null
          positioning_en?: string | null
          positioning_km?: string | null
          site_name_en?: string
          site_name_km?: string
          tagline_en?: string | null
          tagline_km?: string | null
          telegram_handle?: string | null
          updated_at?: string
        }
        Update: {
          analytics_enabled?: boolean
          availability_status_en?: string | null
          availability_status_km?: string | null
          chat_widget_enabled?: boolean
          contact_email?: string | null
          contact_form_enabled?: boolean
          created_at?: string
          default_locale?: Database["public"]["Enums"]["content_locale"]
          default_og_image_media_id?: string | null
          facebook_url?: string | null
          github_url?: string | null
          google_site_verification?: string | null
          hero_headline_en?: string | null
          hero_headline_km?: string | null
          hero_subheadline_en?: string | null
          hero_subheadline_km?: string | null
          id?: boolean
          is_available_for_work?: boolean
          linkedin_url?: string | null
          location_en?: string | null
          location_km?: string | null
          positioning_en?: string | null
          positioning_km?: string | null
          site_name_en?: string
          site_name_km?: string
          tagline_en?: string | null
          tagline_km?: string | null
          telegram_handle?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_settings_og_image_fk"
            columns: ["default_og_image_media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_categories: {
        Row: {
          created_at: string
          description_en: string | null
          description_km: string | null
          icon: string | null
          id: string
          is_published: boolean
          name_en: string
          name_km: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description_en?: string | null
          description_km?: string | null
          icon?: string | null
          id?: string
          is_published?: boolean
          name_en: string
          name_km?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description_en?: string | null
          description_km?: string | null
          icon?: string | null
          id?: string
          is_published?: boolean
          name_en?: string
          name_km?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      skill_certificate_links: {
        Row: {
          certificate_id: string
          skill_id: string
        }
        Insert: {
          certificate_id: string
          skill_id: string
        }
        Update: {
          certificate_id?: string
          skill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_certificate_links_certificate_id_fkey"
            columns: ["certificate_id"]
            isOneToOne: false
            referencedRelation: "certificates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_certificate_links_certificate_id_fkey"
            columns: ["certificate_id"]
            isOneToOne: false
            referencedRelation: "public_certificates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_certificate_links_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_project_links: {
        Row: {
          project_id: string
          skill_id: string
        }
        Insert: {
          project_id: string
          skill_id: string
        }
        Update: {
          project_id?: string
          skill_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_project_links_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_project_links_skill_id_fkey"
            columns: ["skill_id"]
            isOneToOne: false
            referencedRelation: "skills"
            referencedColumns: ["id"]
          },
        ]
      }
      skills: {
        Row: {
          category_id: string
          created_at: string
          description_en: string | null
          description_km: string | null
          id: string
          is_published: boolean
          name_en: string
          name_km: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          description_en?: string | null
          description_km?: string | null
          id?: string
          is_published?: boolean
          name_en: string
          name_km?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          description_en?: string | null
          description_km?: string | null
          id?: string
          is_published?: boolean
          name_en?: string
          name_km?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "skills_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "skill_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      social_links: {
        Row: {
          created_at: string
          handle: string | null
          icon: string | null
          id: string
          is_published: boolean
          label_en: string
          label_km: string | null
          platform: string
          sort_order: number
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          handle?: string | null
          icon?: string | null
          id?: string
          is_published?: boolean
          label_en: string
          label_km?: string | null
          platform: string
          sort_order?: number
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          handle?: string | null
          icon?: string | null
          id?: string
          is_published?: boolean
          label_en?: string
          label_km?: string | null
          platform?: string
          sort_order?: number
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      technologies: {
        Row: {
          created_at: string
          group_name: string | null
          icon: string | null
          id: string
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          group_name?: string | null
          icon?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          group_name?: string | null
          icon?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      testimonial_translations: {
        Row: {
          author_role: string | null
          created_at: string
          id: string
          locale: Database["public"]["Enums"]["content_locale"]
          organization: string | null
          quote: string
          testimonial_id: string
          translation_state: Database["public"]["Enums"]["translation_state"]
          updated_at: string
        }
        Insert: {
          author_role?: string | null
          created_at?: string
          id?: string
          locale: Database["public"]["Enums"]["content_locale"]
          organization?: string | null
          quote: string
          testimonial_id: string
          translation_state?: Database["public"]["Enums"]["translation_state"]
          updated_at?: string
        }
        Update: {
          author_role?: string | null
          created_at?: string
          id?: string
          locale?: Database["public"]["Enums"]["content_locale"]
          organization?: string | null
          quote?: string
          testimonial_id?: string
          translation_state?: Database["public"]["Enums"]["translation_state"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "testimonial_translations_testimonial_id_fkey"
            columns: ["testimonial_id"]
            isOneToOne: false
            referencedRelation: "testimonials"
            referencedColumns: ["id"]
          },
        ]
      }
      testimonials: {
        Row: {
          author_name_en: string
          author_name_km: string | null
          author_url: string | null
          avatar_media_id: string | null
          consent_note: string | null
          consent_recorded_at: string | null
          created_at: string
          deleted_at: string | null
          featured: boolean
          id: string
          published_at: string | null
          relationship: string | null
          slug: string
          sort_order: number
          status: Database["public"]["Enums"]["publication_status"]
          updated_at: string
        }
        Insert: {
          author_name_en: string
          author_name_km?: string | null
          author_url?: string | null
          avatar_media_id?: string | null
          consent_note?: string | null
          consent_recorded_at?: string | null
          created_at?: string
          deleted_at?: string | null
          featured?: boolean
          id?: string
          published_at?: string | null
          relationship?: string | null
          slug: string
          sort_order?: number
          status?: Database["public"]["Enums"]["publication_status"]
          updated_at?: string
        }
        Update: {
          author_name_en?: string
          author_name_km?: string | null
          author_url?: string | null
          avatar_media_id?: string | null
          consent_note?: string | null
          consent_recorded_at?: string | null
          created_at?: string
          deleted_at?: string | null
          featured?: boolean
          id?: string
          published_at?: string | null
          relationship?: string | null
          slug?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["publication_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "testimonials_avatar_media_id_fkey"
            columns: ["avatar_media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_certificates: {
        Row: {
          allow_public_download: boolean | null
          category_id: string | null
          credential_id: string | null
          credential_status:
            | Database["public"]["Enums"]["credential_status"]
            | null
          expires_on: string | null
          featured: boolean | null
          id: string | null
          issued_on: string | null
          issuer_en: string | null
          issuer_km: string | null
          issuer_url: string | null
          og_image_media_id: string | null
          preview_media_id: string | null
          published_at: string | null
          slug: string | null
          sort_order: number | null
          verification_url: string | null
        }
        Insert: {
          allow_public_download?: boolean | null
          category_id?: string | null
          credential_id?: string | null
          credential_status?:
            | Database["public"]["Enums"]["credential_status"]
            | null
          expires_on?: string | null
          featured?: boolean | null
          id?: string | null
          issued_on?: string | null
          issuer_en?: string | null
          issuer_km?: string | null
          issuer_url?: string | null
          og_image_media_id?: string | null
          preview_media_id?: string | null
          published_at?: string | null
          slug?: string | null
          sort_order?: number | null
          verification_url?: string | null
        }
        Update: {
          allow_public_download?: boolean | null
          category_id?: string | null
          credential_id?: string | null
          credential_status?:
            | Database["public"]["Enums"]["credential_status"]
            | null
          expires_on?: string | null
          featured?: boolean | null
          id?: string | null
          issued_on?: string | null
          issuer_en?: string | null
          issuer_km?: string | null
          issuer_url?: string | null
          og_image_media_id?: string | null
          preview_media_id?: string | null
          published_at?: string | null
          slug?: string | null
          sort_order?: number | null
          verification_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certificates_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "certificate_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_og_image_media_id_fkey"
            columns: ["og_image_media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificates_preview_media_id_fkey"
            columns: ["preview_media_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      public_profile: {
        Row: {
          display_name: string | null
          id: string | null
          public_avatar_url: string | null
          public_bio_en: string | null
          public_bio_km: string | null
          public_headline_en: string | null
          public_headline_km: string | null
          public_location: string | null
        }
        Insert: {
          display_name?: string | null
          id?: string | null
          public_avatar_url?: string | null
          public_bio_en?: string | null
          public_bio_km?: string | null
          public_headline_en?: string | null
          public_headline_km?: string | null
          public_location?: string | null
        }
        Update: {
          display_name?: string | null
          id?: string | null
          public_avatar_url?: string | null
          public_bio_en?: string | null
          public_bio_km?: string | null
          public_headline_en?: string | null
          public_headline_km?: string | null
          public_location?: string | null
        }
        Relationships: []
      }
      public_site_counts: {
        Row: {
          featured_projects: number | null
          journey_started_on: string | null
          languages: number | null
          published_certificates: number | null
          published_education: number | null
          published_experiences: number | null
          published_projects: number | null
          published_testimonials: number | null
        }
        Relationships: []
      }
      translation_coverage: {
        Row: {
          entity_id: string | null
          entity_type: string | null
          has_en: boolean | null
          has_km: boolean | null
          slug: string | null
          translations_updated_at: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      activate_resume_version: {
        Args: { p_id: string }
        Returns: {
          created_at: string
          deleted_at: string | null
          download_count: number
          effective_from: string
          id: string
          is_active: boolean
          is_archived: boolean
          locale: Database["public"]["Enums"]["content_locale"]
          media_id: string
          notes: string | null
          updated_at: string
          version_label: string
        }
        SetofOptions: {
          from: "*"
          to: "resume_versions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_content_health: { Args: never; Returns: Json }
      admin_dashboard_summary: { Args: never; Returns: Json }
      admin_insights: { Args: { p_days?: number }; Returns: Json }
      can_edit_content: { Args: never; Returns: boolean }
      can_view_admin: { Args: never; Returns: boolean }
      check_contact_rate_limit: {
        Args: {
          p_cooldown_seconds?: number
          p_ip_hash: string
          p_max_per_hour?: number
        }
        Returns: Json
      }
      current_admin_role: {
        Args: never
        Returns: Database["public"]["Enums"]["admin_role"]
      }
      import_project_case_studies: { Args: never; Returns: undefined }
      is_admin: { Args: never; Returns: boolean }
      is_owner: { Args: never; Returns: boolean }
      is_publicly_visible: {
        Args: {
          deleted_at: string
          published_at: string
          status: Database["public"]["Enums"]["publication_status"]
        }
        Returns: boolean
      }
      is_unreviewed_project_import: {
        Args: { p_slug: string }
        Returns: boolean
      }
      next_revision_no: {
        Args: { p_entity_id: string; p_entity_type: string }
        Returns: number
      }
      record_resume_download: {
        Args: { p_resume_id: string; p_visitor_hash?: string }
        Returns: undefined
      }
      slugify: { Args: { input: string }; Returns: string }
    }
    Enums: {
      admin_role: "owner" | "editor" | "viewer"
      content_locale: "en" | "km"
      credential_status: "active" | "expired" | "revoked" | "unverified"
      file_visibility: "public" | "private"
      media_kind:
        | "project_cover"
        | "project_screenshot"
        | "certificate_preview"
        | "certificate_original"
        | "profile_image"
        | "resume_file"
        | "testimonial_image"
        | "open_graph_image"
        | "diagram"
        | "other"
      message_state: "unread" | "read" | "archived" | "spam"
      project_status:
        | "live"
        | "in_development"
        | "maintained"
        | "sunset"
        | "concept"
      publication_status: "draft" | "in_review" | "published" | "archived"
      translation_state: "missing" | "partial" | "complete" | "needs_review"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null
          avif_autodetection: boolean | null
          created_at: string | null
          file_size_limit: number | null
          id: string
          name: string
          owner: string | null
          owner_id: string | null
          public: boolean | null
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string | null
        }
        Insert: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id: string
          name: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Update: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id?: string
          name?: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Relationships: []
      }
      buckets_analytics: {
        Row: {
          created_at: string
          deleted_at: string | null
          format: string
          id: string
          name: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      buckets_vectors: {
        Row: {
          created_at: string
          id: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      iceberg_namespaces: {
        Row: {
          bucket_name: string
          catalog_id: string
          created_at: string
          id: string
          metadata: Json
          name: string
          updated_at: string
        }
        Insert: {
          bucket_name: string
          catalog_id: string
          created_at?: string
          id?: string
          metadata?: Json
          name: string
          updated_at?: string
        }
        Update: {
          bucket_name?: string
          catalog_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_namespaces_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
        ]
      }
      iceberg_tables: {
        Row: {
          bucket_name: string
          catalog_id: string
          created_at: string
          id: string
          location: string
          name: string
          namespace_id: string
          remote_table_id: string | null
          shard_id: string | null
          shard_key: string | null
          updated_at: string
        }
        Insert: {
          bucket_name: string
          catalog_id: string
          created_at?: string
          id?: string
          location: string
          name: string
          namespace_id: string
          remote_table_id?: string | null
          shard_id?: string | null
          shard_key?: string | null
          updated_at?: string
        }
        Update: {
          bucket_name?: string
          catalog_id?: string
          created_at?: string
          id?: string
          location?: string
          name?: string
          namespace_id?: string
          remote_table_id?: string | null
          shard_id?: string | null
          shard_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_tables_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iceberg_tables_namespace_id_fkey"
            columns: ["namespace_id"]
            isOneToOne: false
            referencedRelation: "iceberg_namespaces"
            referencedColumns: ["id"]
          },
        ]
      }
      migrations: {
        Row: {
          executed_at: string | null
          hash: string
          id: number
          name: string
        }
        Insert: {
          executed_at?: string | null
          hash: string
          id: number
          name: string
        }
        Update: {
          executed_at?: string | null
          hash?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      objects: {
        Row: {
          bucket_id: string | null
          created_at: string | null
          id: string
          last_accessed_at: string | null
          metadata: Json | null
          name: string | null
          owner: string | null
          owner_id: string | null
          path_tokens: string[] | null
          updated_at: string | null
          user_metadata: Json | null
          version: string | null
        }
        Insert: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Update: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          in_progress_size: number
          key: string
          metadata: Json | null
          owner_id: string | null
          upload_signature: string
          user_metadata: Json | null
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id: string
          in_progress_size?: number
          key: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature: string
          user_metadata?: Json | null
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          in_progress_size?: number
          key?: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature?: string
          user_metadata?: Json | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string
          created_at: string
          etag: string
          id: string
          key: string
          owner_id: string | null
          part_number: number
          size: number
          upload_id: string
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          etag: string
          id?: string
          key: string
          owner_id?: string | null
          part_number: number
          size?: number
          upload_id: string
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          etag?: string
          id?: string
          key?: string
          owner_id?: string | null
          part_number?: number
          size?: number
          upload_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "s3_multipart_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      vector_indexes: {
        Row: {
          bucket_id: string
          created_at: string
          data_type: string
          dimension: number
          distance_metric: string
          id: string
          metadata_configuration: Json | null
          name: string
          updated_at: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          data_type: string
          dimension: number
          distance_metric: string
          id?: string
          metadata_configuration?: Json | null
          name: string
          updated_at?: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          data_type?: string
          dimension?: number
          distance_metric?: string
          id?: string
          metadata_configuration?: Json | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vector_indexes_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets_vectors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      allow_any_operation: {
        Args: { expected_operations: string[] }
        Returns: boolean
      }
      allow_only_operation: {
        Args: { expected_operation: string }
        Returns: boolean
      }
      can_insert_object: {
        Args: { bucketid: string; metadata: Json; name: string; owner: string }
        Returns: undefined
      }
      extension: { Args: { name: string }; Returns: string }
      filename: { Args: { name: string }; Returns: string }
      foldername: { Args: { name: string }; Returns: string[] }
      get_common_prefix: {
        Args: { p_delimiter: string; p_key: string; p_prefix: string }
        Returns: string
      }
      get_size_by_bucket: {
        Args: never
        Returns: {
          bucket_id: string
          size: number
        }[]
      }
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_key_token?: string
          next_upload_token?: string
          prefix_param: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
        }[]
      }
      list_objects_with_delimiter: {
        Args: {
          _bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_token?: string
          prefix_param: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      operation: { Args: never; Returns: string }
      search: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_by_timestamp: {
        Args: {
          p_bucket_id: string
          p_level: number
          p_limit: number
          p_prefix: string
          p_sort_column: string
          p_sort_column_after: string
          p_sort_order: string
          p_start_after: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_v2: {
        Args: {
          bucket_name: string
          levels?: number
          limits?: number
          prefix: string
          sort_column?: string
          sort_column_after?: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
    }
    Enums: {
      buckettype: "STANDARD" | "ANALYTICS" | "VECTOR"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      admin_role: ["owner", "editor", "viewer"],
      content_locale: ["en", "km"],
      credential_status: ["active", "expired", "revoked", "unverified"],
      file_visibility: ["public", "private"],
      media_kind: [
        "project_cover",
        "project_screenshot",
        "certificate_preview",
        "certificate_original",
        "profile_image",
        "resume_file",
        "testimonial_image",
        "open_graph_image",
        "diagram",
        "other",
      ],
      message_state: ["unread", "read", "archived", "spam"],
      project_status: [
        "live",
        "in_development",
        "maintained",
        "sunset",
        "concept",
      ],
      publication_status: ["draft", "in_review", "published", "archived"],
      translation_state: ["missing", "partial", "complete", "needs_review"],
    },
  },
  storage: {
    Enums: {
      buckettype: ["STANDARD", "ANALYTICS", "VECTOR"],
    },
  },
} as const

