<template>
  <div class="user-container">
    <div class="header-right-user" @mouseenter="isDropdownVisible = true" @mouseleave="isDropdownVisible = false">
      <el-icon :size="24" color="var(--color-primary)">
        <i-workbench-avatar></i-workbench-avatar>
      </el-icon>
      <div class="name" :title="passportState.showNickname">{{ passportState.showNickname }}</div>
    </div>
    <transition name="el-fade-in">
      <div v-show="isDropdownVisible" class="dropdown-menu" @mouseenter="isDropdownVisible = true"
        @mouseleave="isDropdownVisible = false">
        <div class="menu-header">
          <el-icon :size="36" color="var(--color-primary)"><i-workbench-avatar /></el-icon>
          <div class="text">
            <div class="name">{{ passportState.showNickname }}</div>
            <div class="department">{{ showDepartment }}</div>
          </div>
        </div>
        <div
          v-if="passportState.isLoginUser"
          class="balance-card"
          @click="handleOpenRechargeManagement"
        >
          <div class="balance-card-left">
            <div class="balance-card-text">
              <span class="balance-card-label">{{ $t('workBenchUserCard.creditsLabel') }}</span>
              <span class="balance-card-value">{{ balanceValue }}</span>
            </div>
          </div>
          <button type="button" class="balance-card-action">{{ $t('workBenchUserCard.topUp') }}</button>
        </div>
        <div class="menu-list">
          <div class="menu-item delete-hover" @click="handleBack" v-if="passportState.account.user === ADMIN_USERNAME && isServer">
            <el-icon :size="14"><i-workbench-main-menu /></el-icon>
            <span>{{ $t("WorkBenchUserCard.backToMenu") }}</span>
          </div>
          <router-link to="/user">
            <div class="menu-item">
              <el-icon :size="16"><i-workbench-setting-user /></el-icon>
              <span>{{ $t("WorkBenchUserCard.personalSetting") }}</span>
            </div>
          </router-link>
          <router-link to="/organize" v-if="passportState.account.isAdmin">
            <div class="menu-item">
              <el-icon :size="16"><i-workbench-setting /></el-icon>
              <span>{{ $t("WorkBenchUserCard.adminBackend") }}</span>
            </div>
          </router-link>
          <div class="menu-item access-mobile" @click="showQRCodeDialog">
            <el-icon :size="14"><i-workbench-scan /></el-icon>
            <span>{{ $t("WorkBenchUserCard.accessMobile") }}</span>
          </div>
          <div class="divider"></div>
          <div class="menu-item delete-hover" @click="handleLogout">
            <el-icon :size="14"><i-icon-park-outline-logout /></el-icon>
            <span>{{ $t("WorkBenchUserCard.logout") }}</span>
          </div>
        </div>
      </div>
    </transition>
  </div>
  <teleport to="body">
    <mobile-qr-code-dialog v-model="qrCodeDialogVisible"></mobile-qr-code-dialog>
  </teleport>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { usePassportStore } from '@renderer/stores';
import { ElMessage } from 'element-plus';
import { useRouter } from 'vue-router';
import { OrganizeUtil } from '@renderer/views/nocode/utils';
import { ADMIN_USERNAME, NocodeUser } from "@common/types/account";
import i18next from 'i18next';

const router = useRouter();
const isDropdownVisible = ref(false);
const passportState = usePassportStore();
passportState.init()
const isServer = __IS_SERVER__;
const organizeUtil = new OrganizeUtil();
organizeUtil.getDepartments();

const qrCodeDialogVisible = ref(false);

const balanceValue = computed(() => {
  const value = Number(passportState.user.coin || 0);
  return new Intl.NumberFormat(i18next.resolvedLanguage || i18next.language || "en", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
});

const showDepartment = computed(() => {
    if (passportState.isMainAccount) {
      return `${i18next.t("WorkBenchUserCard.superAdmin")}`;
    }

    const departmentId = (passportState.account as NocodeUser).departments?.[0];
    const department = organizeUtil.departments.find(department => department.id === departmentId);
    return department?.name;
  })

// 显示二维码
const showQRCodeDialog = () => {
  qrCodeDialogVisible.value = true;
};

const handleBack = async () => {
  await router.replace({ path: '/server' });
}

const handleOpenRechargeManagement = async () => {
  isDropdownVisible.value = false;
  await router.push('/recharge-management');
}

const handleLogout = async () => {
  await passportState.logoutAccountActively();
  ElMessage.success(`${i18next.t("WorkBenchUserCard.logoutSuccess")}`);
}

</script>

<style scoped lang='scss'>
.user-container {
  position: relative;
  z-index: 1001;

  .header-right-user {
    // width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: var(--cursor-pointer);
    transition: all 0.3s;

    &:hover {
      opacity: 0.8;
    }

    .name {
      font-family: Inter;
      font-weight: 500;
      font-style: Medium;
      font-size: 14px;
      line-height: 20px;
      letter-spacing: 0%;
      color: var(--text-color-regular);
      padding-left: 4px;
      max-width: 74px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .dropdown-menu {
    padding: 2px;
    position: absolute;
    right: 0;
    top: 56px;
    width: 200px;
    background: var(--bg-color-page);
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
    z-index: 1000;

    .menu-header {
      padding: 8px 12px;
      display: flex;
      align-items: center;
      column-gap: 16px;

      .text {
        padding: 2px 0;
        display: flex;
        flex-direction: column;
        row-gap: 4px;

        .name {
          font-size: 14px;
          font-weight: 500;
          color: var(--text-color-primary);
        }

        .department {
          font-size: 12px;
          color: var(--text-color-secondary)
        }
      }
    }
    
    .balance-card {
      height: 32px;
      padding: 4px;
      padding-left: 8px;
      margin-bottom: 6px;
      border-radius: 4px;
      background: #F7F8FA;
      font-size: 14px;
      color: var(--text-color-primary);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      cursor: var(--cursor-pointer);
      transition: background-color 0.2s ease;

      .balance-card-left {
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .balance-card-icon {
        width: 20px;
        height: 20px;
        flex-shrink: 0;
      }

      .balance-card-text {
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .balance-card-label {
        color: var(--text-color-primary);
        font-size: 14px;
        line-height: 22px;
      }

      .balance-card-value {
        font-size: 14px;
        line-height: 22px;
        font-weight: 500;
        white-space: nowrap;
      }

      .balance-card-action {
        width: 48px;
        height: 24px;
        border: 0;
        border-radius: 4px;
        padding: 1px 10px;
        background: #fff;
        color: var(--color-primary);
        font-size: 12px;
        line-height: 20px;
        cursor: var(--cursor-pointer);
        flex-shrink: 0;

        &:hover {
          box-shadow: 0px 4px 10px 0px #0000001A;
        }
      }
    }

    .menu-list {
      display: flex;
      flex-direction: column;
      .menu-item {
        padding: 8px 12px;
        margin: 4px 0;
        display: flex;
        align-items: center;
        column-gap: 8px;
        font-size: 14px;
        color: var(--text-color-primary);
        cursor: var(--cursor-pointer);
        transition: all 0.2s;
        border-radius: 4px;

        &:hover {
          color: var(--color-primary);
          background-color: rgba(171, 219, 255, 0.4);
        }
      }

      .menu-item:first-child {
        margin-top: 0;
      }

      .access-mobile {
        margin-bottom: 0;
      }

      .menu-item:last-child {
        margin-top: 0;
        margin-bottom: 6px;
      }

      .delete-hover:hover {
        color: var(--color-danger);
        background-color: rgba(255, 229, 229, 0.4);
      }

      .divider {
        height: 1px;
        background: var(--border-color);
        margin: 8px 12px;
      }
    }
  }
}
</style>
