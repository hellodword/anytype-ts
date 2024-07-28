import * as React from 'react';
import { observer } from 'mobx-react';
import { Title, Label, Select, Switch } from 'Component';
import { I, S, U, translate, Action, analytics, C } from 'Lib';

const PopupSettingsPageExtensions = observer(class PopupSettingsPageExtensions extends React.Component<I.PopupSettings> {

	constructor (props: I.PopupSettings) {
		super(props);
	};

	render () {
		return (
			<React.Fragment>
				<Title text="Extensions" />
				<div className="item">
					<Label text="Enable Developer Mode" />
					<Switch className="big" onChange={(e: any, v: boolean) => this.onSetMode(v)} />
				</div>
			</React.Fragment>
		);
	};

	onSetMode (e: boolean) {
		console.log('onSetMode', e);
		C.ExtensionSetMode(e ? 1:0, (message: any) => {
			console.log('ExtensionSetMode', message);
		});
	};

});

export default PopupSettingsPageExtensions;
