import styled from "@emotion/styled";
import type { AriaSelectProps } from "@react-types/select";
import * as React from "react";
import { HiddenSelect, mergeProps, useButton, useFocusRing, useSelect } from "react-aria";
import { useSelectState } from "react-stately";

import { ListBox } from "./ListBox";
import { Popover } from "./Popover";
import { Label, InputContainer } from "./shared";
import { TRIANGLE } from "../../const";
import { interactive } from "../../style/mixins";
import { bevelStyle, buttonPopModifier, iSawTheButtonGlow, iSawTheButtonsGlowLightMode } from "../../style";
import { withDarkMode, type WithDarkMode } from "../../style/darkMode";
import { useAtom } from "jotai";
import { isDarkModeAtom } from "../../atoms/store";
import { UnfoldVertical } from "lucide-react";
import { useItemTransition } from "../transitionState";
import { useRef } from "react";

type ButtonProps = {
  isOpen?: boolean;
  isFocusVisible?: boolean;
} & WithDarkMode;

const Button = styled.button<ButtonProps>`
  appearance: none;
  outline: none;
  display: inline-flex;
  align-items: end;
  justify-content: space-between;
  width: 200px;
  text-align: left;
  ${interactive}
  ${bevelStyle}
  ${buttonPopModifier}
  ${(p) => withDarkMode(p.isDarkMode, iSawTheButtonGlow)}
  ${(p) => p.isOpen && "transform: translate(0px, 1px);"}
`;

const Value = styled.span`
  display: inline-flex;
  align-items: center;
`;

export function Select<T extends object>({ optional, ...props }: AriaSelectProps<T> & { optional?: boolean }) {
  // Create state based on the incoming props
  const state = useSelectState(props);

  // Get props for child elements from useSelect
  const ref = useRef(null);
  const { labelProps, triggerProps, valueProps, menuProps } = useSelect(props, state, ref);

  // Get props for the button based on the trigger props from useSelect
  const { buttonProps } = useButton(triggerProps, ref);

  const { focusProps, isFocusVisible } = useFocusRing();
  const [isDarkMode] = useAtom(isDarkModeAtom);

  const { transitionState, shouldRender } = useItemTransition(state.isOpen, ref);

  return (
    <InputContainer>
      {props.label ? (
        <label {...labelProps}>
          {props.label}
          {optional ? (
            <>
              {" "}
              <i>( optional )</i>
            </>
          ) : null}
        </label>
      ) : null}
      <HiddenSelect state={state} triggerRef={ref} label={props.label} name={props.name} />
      <Button
        isDarkMode={isDarkMode}
        {...mergeProps(buttonProps, focusProps)}
        ref={ref}
        isOpen={state.isOpen}
        isFocusVisible={isFocusVisible}
      >
        <Value {...valueProps}>
          {state.selectedItem ? state.selectedItem.rendered : (props.placeholder ?? "Select an option")}
        </Value>
        <UnfoldVertical size={12} />
      </Button>
      {state.isOpen && (
        <Popover state={state} triggerRef={ref} placement="bottom start" transitionState={transitionState}>
          <ListBox {...menuProps} state={state} />
        </Popover>
      )}
    </InputContainer>
  );
}
