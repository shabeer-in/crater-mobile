import React from 'react';
import * as Linking from 'expo-linking';
import {find} from 'lodash';
import {Field, change, initialize} from 'redux-form';
import {BaseInputPrefix, TemplateField} from '@/components';
import {routes} from '@/navigation';
import t from 'locales/use-translation';
import {alertMe, isEmpty} from '@/constants';
import {
  BaseInput,
  BaseDatePicker,
  DefaultLayout,
  SendMail,
  CustomField,
  View as CtView,
  Notes,
  ItemField,
  FinalAmount,
  BaseButtonGroup,
  BaseButton
} from '@/components';
import {CREATE_INVOICE_FORM, INVOICE_ACTIONS} from 'stores/invoices/types';
import {EDIT_INVOICE_ACTIONS, initialValues} from 'stores/invoices/helpers';
import {
  total,
  tax,
  CompoundTax,
  getCompoundTaxValue,
  totalDiscount,
  getTaxValue,
  getItemList,
  finalAmount
} from '@/components/final-amount/final-amount-calculation';
import {getApiFormattedCustomFields, showNotification} from '@/utils';
import {CustomerSelectModal} from '@/select-modal';
import {setCalculationRef} from 'stores/common/helpers';
import {IProps, IStates} from './create-invoice-type';
import {
  addInvoice,
  fetchInvoiceInitialDetails,
  fetchSingleInvoice,
  updateInvoice,
  changeInvoiceStatus,
  removeInvoice
} from 'stores/invoices/actions';

export default class CreateInvoice extends React.Component<IProps, IStates> {
  invoiceRefs: any;
  sendMailRef: any;
  customerReference: any;

  constructor(props) {
    super(props);
    this.invoiceRefs = setCalculationRef?.bind?.(this);
    this.sendMailRef = React.createRef();
    this.customerReference = React.createRef();

    this.state = {
      currency: props?.currency,
      markAsStatus: null,
      isFetchingInitialData: true
    };
  }

  componentDidMount() {
    this.loadData();
  }

  loadData = () => {
    const {isEditScreen, id, dispatch} = this.props;

    if (isEditScreen) {
      dispatch(fetchSingleInvoice(id, res => this.setInitialData(res)));
      return;
    }
    dispatch(fetchInvoiceInitialDetails(() => this.setInitialData(null)));
    return;
  };

  setInitialData = res => {
    const {
      dispatch,
      invoiceData: {invoiceTemplates} = {},
      invoiceData
    } = this.props;
    let values = {
      ...initialValues(invoiceTemplates),
      ...invoiceData,
      invoice_number: invoiceData?.nextNumber
    };
    if (res) {
      const {data, meta} = res;
      values = {
        ...values,
        ...data,
        invoice_number: data.invoice_no ?? invoiceData?.nextNumber,
        prefix: meta.invoicePrefix ?? invoiceData?.prefix
      };
      this.setState({currency: data?.customer?.currency});
    }

    dispatch(initialize(CREATE_INVOICE_FORM, values));
    this.setState({isFetchingInitialData: false});
  };

  setFormField = (field, value) => {
    this.props.dispatch(change(CREATE_INVOICE_FORM, field, value));
  };

  onDraft = handleSubmit => {
    const {navigation, isEditScreen} = this.props;
    const {isFetchingInitialData} = this.state;

    if (isFetchingInitialData) {
      navigation.navigate(routes.MAIN_INVOICES);
      return;
    }

    if (isEditScreen) {
      navigation.goBack(null);
      return;
    }

    alertMe({
      title: t('invoices.alert.draft_title'),
      showCancel: true,
      cancelText: t('alert.action.discard'),
      cancelPress: () => navigation.navigate(routes.MAIN_INVOICES),
      okText: t('alert.action.save_as_draft'),
      okPress: handleSubmit(this.draftInvoice)
    });
  };

  onSubmitInvoice = (values, status) => {
    const {
      navigation,
      id,
      isSaving,
      isDeleting,
      isCreateScreen,
      dispatch,
      invoiceData: {invoiceTemplates = []} = {}
    } = this.props;
    if (isSaving || isDeleting || this.state.isFetchingInitialData) {
      return;
    }

    if (finalAmount() < 0) {
      alert(t('invoices.alert.less_amount'));
      return;
    }

    let invoice = {
      ...values,
      invoice_number: `${values.prefix}-${values.invoice_number}`,
      invoice_no: values.invoice_number,
      total: finalAmount(),
      sub_total: total(),
      tax: tax() + CompoundTax(),
      discount_val: totalDiscount(),
      taxes: values.taxes
        ? values.taxes.map(val => {
            return {
              ...val,
              amount: val.compound_tax
                ? getCompoundTaxValue(val.percent)
                : getTaxValue(val.percent)
            };
          })
        : []
    };

    if (status === 'send') {
      invoice.invoiceSend = true;
    }

    invoice.invoice_template_id = find(invoiceTemplates, {
      name: invoice?.template_name
    })?.id;

    const params = {
      invoice: {
        ...invoice,
        id,
        customFields: getApiFormattedCustomFields(values?.customFields)
      },
      navigation,
      status,
      onSuccess: () => {
        navigation.navigate(routes.MAIN_INVOICES);
      }
    };
    isCreateScreen
      ? dispatch(addInvoice(params))
      : dispatch(updateInvoice(params));
  };

  downloadInvoice = values => {
    const url = values?.invoicePdfUrl;
    Linking.openURL(url);
    return;
  };

  saveInvoice = values => {
    this.onSubmitInvoice(values, 'save');
  };

  draftInvoice = values => {
    this.onSubmitInvoice(values, 'draft');
  };

  removeInvoice = () => {
    const {dispatch, navigation, id} = this.props;

    alertMe({
      title: t('alert.title'),
      desc: t('invoices.alert.remove_description'),
      showCancel: true,
      okPress: () => dispatch(removeInvoice(id, navigation))
    });
  };

  onOptionSelect = action => {
    const {navigation, formValues, dispatch, id} = this.props;

    switch (action) {
      case INVOICE_ACTIONS.SEND:
        this.sendMailRef?.onToggle();
        break;

      case INVOICE_ACTIONS.MARK_AS_SENT:
        alertMe({
          title: t('alert.title'),
          desc: t('invoices.alert.mark_as_sent'),
          showCancel: true,
          okPress: () =>
            dispatch(
              changeInvoiceStatus({
                id,
                action: `${id}/status`,
                navigation,
                params: {status: 'SENT'},
                onResult: () =>
                  showNotification({
                    message: t('notification.invoice_marked_as_sent')
                  })
              })
            )
        });
        break;

      case INVOICE_ACTIONS.RECORD_PAYMENT:
        const {
          customer_id,
          due_amount,
          sub_total,
          prefix,
          invoice_number
        } = formValues;

        const invoice = {
          customer_id,
          id,
          due: {due_amount, sub_total},
          number: `${prefix}-${invoice_number}`,
          customer: formValues.customer
        };
        navigation.navigate(routes.PAYMENT, {
          type: 'ADD',
          invoice,
          hasRecordPayment: true
        });
        break;

      case INVOICE_ACTIONS.CLONE:
        alertMe({
          title: t('alert.title'),
          desc: t('invoices.alert.clone'),
          showCancel: true,
          okPress: () =>
            dispatch(
              changeInvoiceStatus({
                id,
                action: `${id}/clone`,
                navigation,
                onResult: () =>
                  showNotification({message: t('notification.invoice_cloned')})
              })
            )
        });

        break;

      case INVOICE_ACTIONS.DELETE:
        this.removeInvoice();
        break;

      default:
        break;
    }
  };

  sendEmail = params => {
    const {navigation, dispatch, id} = this.props;

    dispatch(
      changeInvoiceStatus({
        id,
        action: `${id}/send`,
        navigation,
        params,
        onResult: () =>
          showNotification({message: t('notification.invoice_sent')})
      })
    );
  };

  sendMailComponent = () => {
    return (
      <SendMail
        reference={ref => (this.sendMailRef = ref)}
        headerTitle={'header.send_mail_invoice'}
        alertDesc={'invoices.alert.send_invoice'}
        user={this.props.formValues?.customer}
        subject="New Invoice"
        body="invoice_mail_body"
        onSendMail={params => this.sendEmail(params)}
      />
    );
  };

  navigateToCustomer = () => {
    const {navigation} = this.props;
    const {currency} = this.state;

    navigation.navigate(routes.CUSTOMER, {
      type: 'ADD',
      currency,
      onSelect: item => {
        this.customerReference?.changeDisplayValue?.(item);
        this.setFormField('customer_id', item.id);
        this.setState({currency: item.currency});
      }
    });
  };

  render() {
    const {
      navigation,
      handleSubmit,
      invoiceData: {invoiceTemplates} = {},
      selectedItems,
      items,
      getCustomers,
      customers,
      formValues,
      customFields,
      isAllowToEdit,
      isAllowToDelete,
      isEditScreen,
      isSaving,
      isDeleting,
      isLoading,
      notes,
      fetchNotes
    } = this.props;
    const {markAsStatus, isFetchingInitialData} = this.state;
    const disabled = !isAllowToEdit;
    const hasCustomField = isEditScreen
      ? formValues && formValues.hasOwnProperty('fields')
      : !isEmpty(customFields);
    let hasSentStatus = markAsStatus === 'SENT' || markAsStatus === 'VIEWED';
    let hasCompleteStatus = markAsStatus === 'COMPLETED';

    const dropdownOptions =
      isEditScreen && !isFetchingInitialData
        ? EDIT_INVOICE_ACTIONS(
            hasSentStatus,
            hasCompleteStatus,
            isAllowToDelete
          )
        : [];

    let drownDownProps =
      isEditScreen && !isFetchingInitialData
        ? {
            options: dropdownOptions,
            onSelect: this.onOptionSelect,
            cancelButtonIndex: dropdownOptions.length,
            destructiveButtonIndex: dropdownOptions.length - 1,
            ...(!isAllowToDelete && {
              destructiveButtonIndex: dropdownOptions.length + 1
            })
          }
        : null;

    const getTitle = () => {
      let title = 'header.add_invoice';
      if (isEditScreen && !isAllowToEdit) title = 'header.view_invoice';
      if (isEditScreen && isAllowToEdit) title = 'header.edit_invoice';

      return t(title);
    };

    this.invoiceRefs(this);

    const bottomAction = (
      <BaseButtonGroup>
        <BaseButton
          show={isEditScreen && isAllowToEdit}
          type="primary-btn-outline"
          disabled={
            isFetchingInitialData || isSaving || isDeleting || isLoading
          }
          onPress={handleSubmit(this.downloadInvoice)}
        >
          {t('button.view_pdf')}
        </BaseButton>
        <BaseButton
          show={isAllowToEdit}
          loading={isSaving}
          disabled={isFetchingInitialData || isDeleting || isLoading}
          onPress={handleSubmit(this.saveInvoice)}
        >
          {t('button.save')}
        </BaseButton>
      </BaseButtonGroup>
    );

    return (
      <DefaultLayout
        headerProps={{
          leftIconPress: () => this.onDraft(handleSubmit),
          title: getTitle(),
          placement: 'center',
          ...(!isEditScreen && {
            rightIcon: 'save',
            rightIconProps: {solid: true},
            rightIconPress: handleSubmit(this.downloadInvoice)
          })
        }}
        bottomAction={bottomAction}
        loadingProps={{is: isFetchingInitialData}}
        dropdownProps={drownDownProps}
        bodyStyle="px-22 pt-10 pb-15"
      >
        {isEditScreen && !hasCompleteStatus && this.sendMailComponent()}

        <CtView flex={1} flex-row>
          <CtView flex={1} justify-between>
            <Field
              name="invoice_date"
              isRequired
              component={BaseDatePicker}
              label={t('invoices.invoice_date')}
              icon={'calendar-alt'}
              onChangeCallback={val => this.setFormField('invoice_date', val)}
              disabled={disabled}
            />
          </CtView>
          <CtView flex={0.07} />
          <CtView flex={1} justify-between>
            <Field
              name="due_date"
              isRequired
              component={BaseDatePicker}
              label={t('invoices.due_date')}
              icon={'calendar-alt'}
              onChangeCallback={val => this.setFormField('due_date', val)}
              disabled={disabled}
            />
          </CtView>
        </CtView>

        <Field
          name="invoice_number"
          component={BaseInputPrefix}
          label={t('invoices.invoice_number')}
          isRequired
          fieldName="invoice_number"
          prefix={formValues?.prefix}
          disabled={disabled}
        />

        <Field
          name="customer_id"
          getCustomers={getCustomers}
          customers={customers}
          component={CustomerSelectModal}
          selectedItem={formValues?.customer}
          onSelect={item => {
            this.setFormField('customer_id', item.id);
            this.setState({currency: item.currency});
          }}
          rightIconPress={this.navigateToCustomer}
          reference={ref => (this.customerReference = ref)}
          disabled={disabled}
        />

        <ItemField
          {...this.props}
          currency={this.state.currency}
          selectedItems={selectedItems}
          items={getItemList(items)}
          setFormField={this.setFormField}
          screen="invoice"
        />

        <FinalAmount {...this.props} currency={this.state.currency} />

        <Field
          name="reference_number"
          component={BaseInput}
          hint={t('invoices.reference_number')}
          leftIcon={'hashtag'}
          disabled={disabled}
        />

        <Notes
          {...this.props}
          navigation={navigation}
          notes={notes}
          fetchNotes={fetchNotes}
          isEditScreen={isEditScreen}
          noteType={'Invoice'}
          onSelect={this.setFormField}
        />

        <Field
          name="template_name"
          templates={invoiceTemplates ?? []}
          component={TemplateField}
          label={t('invoices.template')}
          icon={'file-alt'}
          placeholder={t('invoices.template_placeholder')}
          navigation={navigation}
          disabled={disabled}
        />

        {hasCustomField && <CustomField {...this.props} type={null} />}
      </DefaultLayout>
    );
  }
}
