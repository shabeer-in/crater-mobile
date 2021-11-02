import React from 'react';
import {ITheme} from '@/interfaces';

export interface IProps {
  /**
   * Either children or a render prop that receives a boolean reflecting whether
   * the component is currently pressed.
   */
  children?: React.ReactNode | any;

  /**
   * If true, show loader together with content.
   */
  withLoading?: boolean;

  /**
   * An additional loading accessibility.
   */
  loadingProps?: any;

  /**
   * An additional empty content accessibility.
   */
  emptyProps?: any;

  /**
   * An active theme object.
   * @see ITheme
   */
  theme?: ITheme;
}
