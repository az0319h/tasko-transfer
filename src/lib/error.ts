import { AuthError } from "@supabase/supabase-js";

export const AUTH_ERROR_MESSAGE_MAP: Record<string, string> = {
  unexpected_failure: "알 수 없는 오류가 발생했습니다.",
  validation_failed: "입력한 정보가 올바르지 않습니다.",
  bad_json: "요청 형식이 올바르지 않습니다.",

  email_exists: "이미 사용 중인 이메일입니다.",
  phone_exists: "이미 사용 중인 전화번호입니다.",

  bad_jwt: "인증 정보가 유효하지 않습니다.",
  not_admin: "관리자 권한이 필요합니다.",
  no_authorization: "인증되지 않은 요청입니다.",

  user_not_found: "해당 사용자를 찾을 수 없습니다.",
  session_not_found: "세션 정보를 찾을 수 없습니다.",
  session_expired: "세션이 만료되었습니다. 다시 로그인해주세요.",

  refresh_token_not_found: "인증 토큰을 찾을 수 없습니다.",
  refresh_token_already_used: "이미 사용된 인증 토큰입니다.",

  flow_state_not_found: "인증 상태를 찾을 수 없습니다.",
  flow_state_expired: "인증 시간이 만료되었습니다.",

  signup_disabled: "현재 회원가입이 비활성화되어 있습니다.",
  user_banned: "해당 계정은 이용이 제한되었습니다.",

  provider_email_needs_verification: "이메일 인증이 필요합니다.",
  invite_not_found: "유효하지 않은 초대 링크입니다.",

  bad_oauth_state: "OAuth 인증 상태가 올바르지 않습니다.",
  bad_oauth_callback: "OAuth 인증 처리 중 오류가 발생했습니다.",
  oauth_provider_not_supported: "지원하지 않는 OAuth 제공자입니다.",

  unexpected_audience: "인증 대상이 올바르지 않습니다.",

  single_identity_not_deletable: "해당 계정은 삭제할 수 없습니다.",
  email_conflict_identity_not_deletable: "이메일 충돌로 인해 계정을 삭제할 수 없습니다.",

  identity_already_exists: "이미 연결된 계정 정보가 존재합니다.",

  email_provider_disabled: "이메일 로그인 기능이 비활성화되어 있습니다.",
  phone_provider_disabled: "전화번호 로그인 기능이 비활성화되어 있습니다.",

  too_many_enrolled_mfa_factors: "등록 가능한 다중 인증 수를 초과했습니다.",

  mfa_factor_name_conflict: "이미 존재하는 MFA 인증 수단 이름입니다.",
  mfa_factor_not_found: "해당 MFA 인증 수단을 찾을 수 없습니다.",
  mfa_ip_address_mismatch: "인증 요청 IP가 일치하지 않습니다.",
  mfa_challenge_expired: "다중 인증 요청 시간이 만료되었습니다.",
  mfa_verification_failed: "다중 인증에 실패했습니다.",
  mfa_verification_rejected: "다중 인증 요청이 거부되었습니다.",

  insufficient_aal: "추가 인증이 필요합니다.",

  captcha_failed: "보안 인증에 실패했습니다. 다시 시도해주세요.",

  saml_provider_disabled: "SAML 로그인 기능이 비활성화되어 있습니다.",
  manual_linking_disabled: "계정 수동 연결이 허용되지 않습니다.",

  sms_send_failed: "문자 메시지 전송에 실패했습니다.",

  email_not_confirmed: "이메일 인증이 완료되지 않았습니다.",
  phone_not_confirmed: "전화번호 인증이 완료되지 않았습니다.",

  reauth_nonce_missing: "재인증 정보가 누락되었습니다.",

  saml_relay_state_not_found: "SAML 인증 상태를 찾을 수 없습니다.",
  saml_relay_state_expired: "SAML 인증 시간이 만료되었습니다.",
  saml_idp_not_found: "SAML 인증 제공자를 찾을 수 없습니다.",
  saml_assertion_no_user_id: "SAML 응답에 사용자 정보가 없습니다.",
  saml_assertion_no_email: "SAML 응답에 이메일 정보가 없습니다.",

  user_already_exists: "이미 가입된 사용자입니다.",

  sso_provider_not_found: "SSO 제공자를 찾을 수 없습니다.",
  saml_metadata_fetch_failed: "SAML 메타데이터를 불러오지 못했습니다.",
  saml_idp_already_exists: "이미 등록된 SAML 제공자입니다.",
  sso_domain_already_exists: "이미 등록된 SSO 도메인입니다.",
  saml_entity_id_mismatch: "SAML 엔티티 ID가 일치하지 않습니다.",

  conflict: "요청이 충돌했습니다.",
  provider_disabled: "해당 로그인 제공자가 비활성화되어 있습니다.",
  user_sso_managed: "SSO로 관리되는 계정입니다.",

  reauthentication_needed: "보안을 위해 다시 인증이 필요합니다.",
  same_password: "이전과 동일한 비밀번호는 사용할 수 없습니다.",
  reauthentication_not_valid: "재인증 정보가 유효하지 않습니다.",

  otp_expired:
    "코드가 올바르지 않거나 만료되었습니다. 새 코드를 다시 요청하거나 코드를 다시 확인해주세요.",
  otp_disabled: "OTP 인증이 비활성화되어 있습니다.",

  identity_not_found: "연결된 계정 정보를 찾을 수 없습니다.",
  weak_password: "비밀번호가 너무 약합니다.",

  over_request_rate_limit: "요청 횟수가 너무 많습니다. 잠시 후 다시 시도해주세요.",
  over_email_send_rate_limit: "이메일 전송 한도를 초과했습니다. 잠시 후 다시 시도해주세요.",
  over_sms_send_rate_limit: "문자 전송 한도를 초과했습니다. 잠시 후 다시 시도해주세요.",

  bad_code_verifier: "인증 코드 검증에 실패했습니다.",

  anonymous_provider_disabled: "익명 로그인 기능이 비활성화되어 있습니다.",

  hook_timeout: "서버 처리 시간이 초과되었습니다.",
  hook_timeout_after_retry: "재시도 후에도 서버 응답이 없습니다.",
  hook_payload_over_size_limit: "요청 데이터 크기가 허용 범위를 초과했습니다.",
  hook_payload_invalid_content_type: "요청 데이터 형식이 올바르지 않습니다.",

  request_timeout: "요청 시간이 초과되었습니다.",

  mfa_phone_enroll_not_enabled: "전화번호 기반 다중 인증 등록이 허용되지 않습니다.",
  mfa_phone_verify_not_enabled: "전화번호 기반 다중 인증 확인이 허용되지 않습니다.",
  mfa_totp_enroll_not_enabled: "OTP 기반 다중 인증 등록이 허용되지 않습니다.",
  mfa_totp_verify_not_enabled: "OTP 기반 다중 인증 확인이 허용되지 않습니다.",
  mfa_webauthn_enroll_not_enabled: "WebAuthn 다중 인증 등록이 허용되지 않습니다.",
  mfa_webauthn_verify_not_enabled: "WebAuthn 다중 인증 확인이 허용되지 않습니다.",

  mfa_verified_factor_exists: "이미 인증된 다중 인증 수단이 존재합니다.",

  invalid_credentials: "이메일 또는 비밀번호가 올바르지 않습니다.",
  email_address_not_authorized: "허용되지 않은 이메일 주소입니다.",
  email_address_invalid: "유효하지 않은 이메일 주소입니다.",
};

export function generateErrorMessage(error: unknown) {
  if (error instanceof AuthError && error.code) {
    return (
      AUTH_ERROR_MESSAGE_MAP[error.code] ??
      "알 수 없는 인증 오류가 발생했습니다.  잠시 후 다시 시도하세요"
    );
  }

  return "문제가 발생했습니다. 나중에 다시 시도하세요!";
}
