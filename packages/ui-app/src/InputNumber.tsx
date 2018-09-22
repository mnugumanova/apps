// Copyright 2017-2018 @polkadot/ui-app authors & contributors
// This software may be modified and distributed under the terms
// of the ISC license. See the LICENSE file for details.

import { BareProps, BitLength, I18nProps } from './types';

import BN from 'bn.js';
import React from 'react';
import isString from '@polkadot/util/is/string';

import classes from './util/classes';
import { BitLengthOption } from './constants';
import Input, { KEYS, KEYS_PRE, isCopy, isCut, isPaste, isSelectAll } from './Input';
import translate from './translate';

type Props = BareProps & I18nProps & {
  bitLength?: BitLength,
  defaultValue?: string,
  isError?: boolean,
  label?: any,
  maxLength?: number,
  onChange: (value: BN) => void,
  placeholder?: string,
  withLabel?: boolean
};

type State = {
  isPreKeyDown: boolean,
  isValid: boolean,
  previousValue: string
};

const DEFAULT_BITLENGTH = BitLengthOption.NORMAL_NUMBERS as BitLength;
const KEYS_ALLOWED: Array<any> = [KEYS.ARROW_LEFT, KEYS.ARROW_RIGHT, KEYS.BACKSPACE, KEYS.ENTER, KEYS.ESCAPE, KEYS.TAB];

function maxConservativeLength (maxValueLength: number): number {
  const conservativenessFactor = 1;

  return maxValueLength - conservativenessFactor;
}

class InputNumber extends React.PureComponent<Props, State> {
  state: State = {
    isPreKeyDown: false,
    isValid: false,
    previousValue: '0'
  };

  render () {
    const { bitLength = DEFAULT_BITLENGTH, className, defaultValue, maxLength, style, t } = this.props;
    const { isValid, previousValue } = this.state;
    const revertedValue = !isValid ? previousValue : undefined;
    const maxValueLength = this.maxValue(bitLength).toString().length;

    return (
      <div
        className={classes('ui--InputNumber', className)}
        style={style}
      >
        <Input
          {...this.props}
          defaultValue={defaultValue || '0'}
          maxLength={maxLength || maxConservativeLength(maxValueLength)}
          onChange={this.onChange}
          onKeyDown={this.onKeyDown}
          onKeyUp={this.onKeyUp}
          placeholder={t('inputnumber.placeholder', {
            defaultValue: 'Positive number'
          })}
          type='text'
          value={revertedValue}
        />
      </div>
    );
  }

  private maxValue = (bitLength?: number): BN =>
    new BN(2).pow(new BN(bitLength || DEFAULT_BITLENGTH)).subn(1)

  // check if string value is non-integer even if above MAX_SAFE_INTEGER. isNaN(Number(value)) is faster for values of length 1
  private isNonInteger = (value: string): boolean =>
    value && value.length && value.split('').find(value => '0123456789'.indexOf(value) === -1) ? true : false

  private isValidBitLength = (value: BN, bitLength?: number): boolean =>
    value.bitLength() <= (bitLength || DEFAULT_BITLENGTH)

  private isValidKey = (event: React.KeyboardEvent<Element>, isPreKeyDown: boolean): boolean => {
    // prevent use of shift key
    if (event.shiftKey) {
      return false;
    }

    // allow cut/copy/paste combinations but not non-numeric letters (i.e. a, c, x, v) individually
    if (
      (isSelectAll(event.key, isPreKeyDown)) ||
      (isCut(event.key, isPreKeyDown)) ||
      (isCopy(event.key, isPreKeyDown)) ||
      (isPaste(event.key, isPreKeyDown))
    ) {
      return true;
    }

    if (isNaN(Number(event.key)) && !KEYS_ALLOWED.includes(event.key)) {
      return false;
    }

    return true;
  }

  private isValidNumber = (input: string, bitLength?: number): boolean => {
    const { t } = this.props;
    bitLength = bitLength || DEFAULT_BITLENGTH;

    // failsafe as expects only positive integers as permitted by onKeyDown from input of type text
    if (!isString(input)) {
      throw Error(t('inputnumber.error.string.required', {
        defaultValue: 'Number input value must be valid type'
      }));
    }

    // remove spaces even though not possible as user restricted from entering spacebar key in onKeyDown
    input = input.toLowerCase().split(' ').join('');

    if (this.isNonInteger(input)) {
      return false;
    }

    // max is (2 ** 128 - 1) for bitLength of 128 bit
    const maxBN = this.maxValue(bitLength);
    const inputBN = new BN(input);

    if (!inputBN.lt(maxBN) || !this.isValidBitLength(inputBN, bitLength)) {
      return false;
    }

    return true;
  }

  private onChange = (value: string): void => {
    const { onChange } = this.props;
    let isValid = false;

    try {
      const valueBN = new BN(value || 0);

      if (value === '') {
        isValid = false;
        console.log('cannot propagate !isValid up to parent component without being able to pass isValid as argument to onChange to disable the submit button');
      } else {
        isValid = this.isValidNumber(value);
        this.setState({ isValid });
      }

      if (!onChange || !isValid) {
        return;
      }

      onChange(valueBN);
    } catch (error) {
      console.error(error);
    }
  }

  private onKeyDown = (event: React.KeyboardEvent<Element>): void => {
    const { isPreKeyDown } = this.state;
    const { value: previousValue } = event.target as HTMLInputElement;

    // store previous input field in state incase user pastes invalid value and we need to revert the input value
    this.setState({ previousValue });

    // prevent duplicate 0's (entry of another 0 when existing value is 0)
    if (previousValue[0] === '0' && event.key === KEYS.ZERO) {
      event.preventDefault();
    }

    if (KEYS_PRE.includes(event.key)) {
      this.setState({ isPreKeyDown: true });
    }

    // restrict input of certain keys
    const isValid = this.isValidKey(event, isPreKeyDown);

    // obtain the current cursor index position in the input field
    // i.e. initial index is 0
    const previousInputCursorIndex = event.target.value.slice(0, event.target.selectionStart).length;

    // obtain the value at the current cursor index position
    // i.e. value on LHS of the index, when in index 0 the value is ''
    const previousCursorIndexLHSValue = event.target.value.charAt(previousInputCursorIndex - 1);

    console.log('previousInputCursorIndex, previousCursorIndexLHSValue', previousInputCursorIndex, previousCursorIndexLHSValue);

    // if previousValue is 0, and cursor index is >= 1
    if (previousValue[0] === '0' && inputCursorIndex >= 1) {
      // allow cut, copy, paste, select all
      // do not allow integer input
      if (!isNaN(Number(event.key)) || isPaste(event.key, isPreKeyDown)) {
        event.preventDefault();
      }
    }

    // // reset the value to 0, if previousValue is not 0 (since not restricted earlier from being deleted), 
    // // and cursor index is == 1, and key is backspace
    // if (previousValue[0] !== '0' && inputCursorIndex === 1 && event.key === KEYS.BACKSPACE) {
    //   (event.target as HTMLInputElement).value = '0';
    // }

    // reset the value to 0, if previousValue is not 0 (since not restricted earlier from being deleted)
    // and cursor index is any, and isSelectAll, and key is backspace

    console.log(event.target.value);

    if (!isValid) {
      event.preventDefault();
    }
  }

  private onKeyUp = (event: React.KeyboardEvent<Element>): void => {
    const { value: newValue } = event.target as HTMLInputElement;

    if (KEYS_PRE.includes(event.key)) {
      this.setState({ isPreKeyDown: false });
    }

    // obtain the current cursor index position in the input field
    // i.e. initial index is 0
    const inputCursorIndex = event.target.value.slice(0, event.target.selectionStart).length;

    // obtain the value at the current cursor index position
    // i.e. value on LHS of the index, when in index 0 the value is ''
    const currentCursorIndex = event.target.value.charAt(inputCursorIndex - 1);


    console.log('XXinputCursorIndex: ', inputCursorIndex);
    // reset the value to 0, if newValue first char not 0 (since not restricted earlier from being deleted), 
    // and cursor index is == 1, and key is backspace
    if (newValue[0] !== '0' && event.target.value.length === 1 && event.key === KEYS.BACKSPACE) {
      (event.target as HTMLInputElement).value = '0';
    }

    // // reset the value to 0 if first digit of new value is 0 and the user entered a digit after it
    // if (newValue[0] === '0' && newValue.length > 1) {
    //   (event.target as HTMLInputElement).value = '0';
    // }

    // console.log(event.target.value);
  }
}

export {
  InputNumber,
  maxConservativeLength
};

export default translate(InputNumber);
