import React from 'react';
import {View, StyleSheet} from 'react-native';
import {Text} from '../text';
import {CtButton} from '../button';
import {AssetImage} from '../asset-image';
import {BUTTON_TYPE, hasTextLength} from '@/constants';
import {PermissionService} from '@/services';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp
} from 'react-native-responsive-screen';
import {IProps} from './type.d';

export const Empty = (props: IProps) => {
  const {
    title,
    description,
    image,
    buttonTitle,
    buttonPress,
    route,
    theme
  } = props;
  let showButton = hasTextLength(buttonTitle);

  if (route && hasTextLength(buttonTitle)) {
    showButton = PermissionService.isAllowToCreate(route?.name);
  }

  return (
    <View style={styles.emptyContainer}>
      {image && <AssetImage source={image} style={styles.emptyImage} />}

      <Text
        mediumSize
        bold2
        center
        font-weight-600
        numberOfLines={2}
        color={theme?.listItem?.fifth?.color}
        style={styles.emptyTitle}
      >
        {title && title}
      </Text>

      <Text
        center
        numberOfLines={2}
        color={theme?.text?.thirdColor}
        style={styles.emptyDescription}
        medium={theme?.mode === 'dark'}
      >
        {description && description}
      </Text>

      {showButton && (
        <CtButton
          onPress={buttonPress && buttonPress}
          btnTitle={buttonTitle}
          type={BUTTON_TYPE.OUTLINE}
          hasFocus={false}
          buttonContainerStyle={styles.emptyButton}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  emptyContainer: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center'
  },
  emptyImage: {
    height: hp('20%'),
    width: wp('40%'),
    resizeMode: 'contain'
  },
  emptyTitle: {
    marginTop: 15,
    paddingHorizontal: 10
  },
  emptyDescription: {
    paddingHorizontal: 10,
    marginTop: 5
  },
  emptyButton: {
    marginTop: 22,
    marginHorizontal: 40
  }
});
