import {PermissionService} from '@/services';

export const permissionSelector = navigation => {
  const type = navigation?.getParam?.('type', 'ADD');
  const isEditScreen = type === 'UPDATE';
  const isAllowToEdit = isEditScreen
    ? PermissionService.isAllowToEdit(navigation?.state?.routeName)
    : true;
  const isAllowToDelete = isEditScreen
    ? PermissionService.isAllowToDelete(navigation?.state?.routeName)
    : true;

  return {
    type,
    isCreateScreen: !isEditScreen,
    isEditScreen,
    isAllowToEdit,
    isAllowToDelete
  };
};

export const commonSelector = state => {
  const {common} = state;
  return {
    locale: common?.locale,
    theme: common?.theme,
    abilities: common?.abilities
  };
};
